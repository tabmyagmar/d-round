import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../client";
import type { PrismaClient } from "../client";

import { createOutboxEmailRepository } from "./outbox-email.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("outbox email repository", () => {
  it("creates PENDING rows and moves them through SENT / FAILED", async () => {
    const repo = createOutboxEmailRepository(prisma);
    const row = await repo.create({
      to: "a@example.com",
      template: "verification-email",
      payload: { url: "https://x" },
    });
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(0);

    const failedOnce = await repo.recordFailedAttempt(row.id, "smtp timeout");
    expect(failedOnce).toMatchObject({ status: "PENDING", attempts: 1, lastError: "smtp timeout" });

    const sent = await repo.markSent(row.id);
    expect(sent.status).toBe("SENT");
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(sent.lastError).toBeNull();

    const other = await repo.create({ to: "b@example.com", template: "x", payload: {} });
    const failed = await repo.markFailed(other.id, "mailbox does not exist");
    expect(failed).toMatchObject({ status: "FAILED", attempts: 1 });
    expect((await repo.resetToPending(other.id)).status).toBe("PENDING");
  });

  it("finds stale PENDING rows only", async () => {
    const repo = createOutboxEmailRepository(prisma);
    const template = `stale-${crypto.randomUUID()}`;
    const stale = await repo.create({ to: "s@example.com", template, payload: {} });
    await prisma.outboxEmail.update({
      where: { id: stale.id },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });
    const fresh = await repo.create({ to: "f@example.com", template, payload: {} });
    const sent = await repo.create({ to: "d@example.com", template, payload: {} });
    await repo.markSent(sent.id);
    await prisma.outboxEmail.update({
      where: { id: sent.id },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });

    const found = await repo.findStalePending(new Date(Date.now() - 60_000));
    const ids = found.filter((r) => r.template === template).map((r) => r.id);

    expect(ids).toEqual([stale.id]);
    expect(ids).not.toContain(fresh.id);
  });
});

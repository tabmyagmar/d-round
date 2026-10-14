import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createAuditLogRepository } from "../../src/repositories/audit-log.repository";
import type { AuditLogData } from "../../src/repositories/audit-log.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

/** A success row of a test-unique action, so tests never see each other's rows. */
const rowOf = (action: string, data: Partial<AuditLogData> = {}): AuditLogData => ({
  actorType: "USER",
  actorId: crypto.randomUUID(),
  actorName: "監査 太郎",
  actorEmail: "kansa@example.com",
  actorRole: "admin",
  action,
  status: "SUCCESS",
  ...data,
});

const uniqueAction = (): string => `test.${crypto.randomUUID().slice(0, 8)}`;

describe("audit log repository", () => {
  it("records rows one by one and in bulk and lists them newest first without their changes", async () => {
    const repo = createAuditLogRepository(prisma);
    const action = uniqueAction();
    const first = await repo.create(
      rowOf(action, {
        createdAt: daysAgo(2),
        entityType: "Client",
        entityId: crypto.randomUUID(),
        entityLabel: "1024 株式会社サンプル",
        changes: [{ field: "name", before: "旧社名", after: "株式会社サンプル" }],
      }),
    );
    expect(
      await repo.createMany([
        rowOf(action, { createdAt: daysAgo(1) }),
        rowOf(action, { status: "FAILURE", errorCode: "FORBIDDEN" }),
      ]),
    ).toBe(2);
    expect(await repo.createMany([])).toBe(0);

    const page = await repo.findPage({ page: 1, perPage: 10 }, { action });

    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.status)).toEqual(["FAILURE", "SUCCESS", "SUCCESS"]);
    expect(page.items.at(-1)?.id).toBe(first.id);
    // The list carries what its columns show; the detail reads the rest by id.
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
      "action",
      "actorEmail",
      "actorName",
      "actorType",
      "createdAt",
      "entityLabel",
      "entityType",
      "id",
      "status",
    ]);
    expect((await repo.findById(first.id))?.changes).toEqual([
      { field: "name", before: "旧社名", after: "株式会社サンプル" },
    ]);
  });

  it("filters a page by the where it is given", async () => {
    const repo = createAuditLogRepository(prisma);
    const action = uniqueAction();
    const actorId = crypto.randomUUID();
    await repo.createMany([
      rowOf(action, { actorId, entityLabel: "A" }),
      rowOf(action, { actorId, status: "FAILURE", errorCode: "CONFLICT", entityLabel: "B" }),
      rowOf(action, { status: "FAILURE", entityLabel: "C" }),
    ]);

    const page = await repo.findPage(
      { page: 1, perPage: 10 },
      { action, actorId, status: "FAILURE" },
    );

    expect(page.items.map((item) => item.entityLabel)).toEqual(["B"]);
  });

  it("pages an entity's history by cursor, newest first", async () => {
    const repo = createAuditLogRepository(prisma);
    const entity = { entityType: "Staff", entityId: crypto.randomUUID() };
    const action = uniqueAction();
    await repo.createMany([
      rowOf(action, { ...entity, createdAt: daysAgo(3), entityLabel: "1" }),
      rowOf(action, { ...entity, createdAt: daysAgo(2), entityLabel: "2" }),
      rowOf(action, { ...entity, createdAt: daysAgo(1), entityLabel: "3" }),
      rowOf(action, { entityType: "Staff", entityId: crypto.randomUUID() }),
    ]);

    const first = await repo.findHistory(entity, { take: 2 });
    expect(first.items.map((item) => item.entityLabel)).toEqual(["3", "2"]);
    expect(first.nextCursor).toBe(first.items[1]?.id);

    const second = await repo.findHistory(entity, { cursor: first.nextCursor, take: 2 });
    expect(second.items.map((item) => item.entityLabel)).toEqual(["1"]);
    expect(second.nextCursor).toBeNull();
  });

  it("deletes only rows older than the cut-off, at most `limit` at a time, oldest first", async () => {
    const repo = createAuditLogRepository(prisma);
    const action = uniqueAction();
    await repo.createMany([
      rowOf(action, { createdAt: daysAgo(120), entityLabel: "oldest" }),
      rowOf(action, { createdAt: daysAgo(110), entityLabel: "older" }),
      rowOf(action, { createdAt: daysAgo(10), entityLabel: "young" }),
    ]);
    const cutoff = daysAgo(91);

    expect(await repo.deleteOlderThan(cutoff, 1)).toBe(1);
    const left = await repo.findPage({ page: 1, perPage: 10 }, { action });
    expect(left.items.map((item) => item.entityLabel)).toEqual(["young", "older"]);

    expect(await repo.deleteOlderThan(cutoff, 1000)).toBeGreaterThanOrEqual(1);
    expect(await repo.deleteOlderThan(cutoff, 1000)).toBe(0);
    const young = await repo.findPage({ page: 1, perPage: 10 }, { action });
    expect(young.items.map((item) => item.entityLabel)).toEqual(["young"]);
  });

  describe("append-only trigger", () => {
    it("refuses an update", async () => {
      const row = await createAuditLogRepository(prisma).create(rowOf(uniqueAction()));

      await expect(
        prisma.auditLog.update({ where: { id: row.id }, data: { actorName: "改ざん" } }),
      ).rejects.toThrow(/append-only/);
      expect((await prisma.auditLog.findUnique({ where: { id: row.id } }))?.actorName).toBe(
        "監査 太郎",
      );
    });

    it("refuses to delete a row younger than 90 days, by id or by raw SQL", async () => {
      const row = await createAuditLogRepository(prisma).create(
        rowOf(uniqueAction(), { createdAt: daysAgo(89) }),
      );

      await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/90 days/);
      await expect(
        prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${row.id}::uuid`,
      ).rejects.toThrow(/90 days/);
      expect(await prisma.auditLog.findUnique({ where: { id: row.id } })).not.toBeNull();
    });

    it("refuses a truncate", async () => {
      await expect(prisma.$executeRaw`TRUNCATE audit_logs`).rejects.toThrow(/append-only/);
    });
  });
});

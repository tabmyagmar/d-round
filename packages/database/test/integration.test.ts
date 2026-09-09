import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../src/client";
import type { PrismaClient } from "../src/client";

/**
 * Proves the testcontainers + migrations + generated client chain works end to end.
 * If this test fails nothing else database-related can be trusted.
 */
let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database integration", () => {
  it("has the migrations applied and can round-trip a HealthCheck row", async () => {
    const note = `integration-${crypto.randomUUID()}`;

    const created = await prisma.healthCheck.create({ data: { note } });
    const found = await prisma.healthCheck.findUnique({ where: { id: created.id } });

    expect(found).not.toBeNull();
    expect(found?.note).toBe(note);
    expect(found?.createdAt).toBeInstanceOf(Date);
    // UUID v7 primary key
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("answers SELECT 1 (used by the /health endpoint)", async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(rows[0]?.ok).toBe(1);
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { AfterCommitError, withTransaction } from "../../src/utils/transaction";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const countNotes = (note: string): Promise<number> => prisma.healthCheck.count({ where: { note } });

describe("withTransaction", () => {
  it("commits and then runs after-commit hooks exactly once, in order", async () => {
    const note = `tx-commit-${crypto.randomUUID()}`;
    const calls: string[] = [];

    const created = await withTransaction(prisma, async ({ tx, afterCommit }) => {
      const row = await tx.healthCheck.create({ data: { note } });
      afterCommit(() => {
        calls.push("first");
      });
      afterCommit(async () => {
        // The row must already be visible outside the transaction when hooks run.
        calls.push(`second:${String(await countNotes(note))}`);
      });
      return row;
    });

    expect(created.note).toBe(note);
    expect(await countNotes(note)).toBe(1);
    expect(calls).toEqual(["first", "second:1"]);
  });

  it("rolls back and skips hooks when the callback throws", async () => {
    const note = `tx-rollback-${crypto.randomUUID()}`;
    let hookRan = false;

    await expect(
      withTransaction(prisma, async ({ tx, afterCommit }) => {
        await tx.healthCheck.create({ data: { note } });
        afterCommit(() => {
          hookRan = true;
        });
        throw new Error("business rule failed");
      }),
    ).rejects.toThrow("business rule failed");

    expect(await countNotes(note)).toBe(0);
    expect(hookRan).toBe(false);
  });

  it("keeps the commit and reports hook failures", async () => {
    const note = `tx-hook-failure-${crypto.randomUUID()}`;

    await expect(
      withTransaction(prisma, async ({ tx, afterCommit }) => {
        await tx.healthCheck.create({ data: { note } });
        afterCommit(() => {
          throw new Error("queue unavailable");
        });
      }),
    ).rejects.toBeInstanceOf(AfterCommitError);

    expect(await countNotes(note)).toBe(1);
  });

  it("routes hook failures to onAfterCommitError when provided", async () => {
    const note = `tx-hook-handler-${crypto.randomUUID()}`;
    const seen: unknown[] = [];

    const result = await withTransaction(
      prisma,
      async ({ tx, afterCommit }) => {
        await tx.healthCheck.create({ data: { note } });
        afterCommit(() => {
          throw new Error("queue unavailable");
        });
        return "done";
      },
      { onAfterCommitError: (error) => seen.push(error) },
    );

    expect(result).toBe("done");
    expect(seen).toHaveLength(1);
    expect(await countNotes(note)).toBe(1);
  });
});

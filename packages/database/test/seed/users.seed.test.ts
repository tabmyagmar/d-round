import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { SEED_PASSWORD, SEED_USERS, seedUsers } from "../../prisma/seed/users.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// Only this file touches the SEED_USERS emails, so it may run in parallel with the other
// database test files on the shared container.

// The accounts are created only for development or test, so pin NODE_ENV for this file instead of
// relying on Vitest's default; the skip tests override it per call with withNodeEnv.

let prisma: PrismaClient;
let previousNodeEnv: string | undefined;

beforeAll(() => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

const ADMIN_EMAIL = SEED_USERS.find((seed) => seed.role === "admin")!.email;
const SEED_EMAILS = SEED_USERS.map((seed) => seed.email);

const findSeedUser = (email: string) =>
  prisma.user.findUniqueOrThrow({
    where: { email },
    include: { accounts: { where: { providerId: "credential" } } },
  });

const SKIPPED = {
  dataset: "users",
  rows: SEED_USERS.length,
  created: 0,
  updated: 0,
  skipped: SEED_USERS.length,
};

/** Runs `run` with NODE_ENV set to `value` (unset when undefined), then restores it. */
const withNodeEnv = async <T>(value: string | undefined, run: () => Promise<T>): Promise<T> => {
  const previous = process.env.NODE_ENV;
  // Assigning undefined to process.env stores the string "undefined", so delete instead.
  const apply = (next: string | undefined) => {
    if (next === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = next;
    }
  };
  apply(value);
  try {
    return await run();
  } finally {
    apply(previous);
  }
};

describe("seedUsers", () => {
  it("creates every test account verified, with its role and one working credential login", async () => {
    await prisma.user.deleteMany({ where: { email: { in: SEED_EMAILS } } });

    const summary = await seedUsers(prisma);

    expect(summary).toEqual({
      dataset: "users",
      rows: SEED_USERS.length,
      created: SEED_USERS.length,
      updated: 0,
      skipped: 0,
    });

    for (const seed of SEED_USERS) {
      const user = await findSeedUser(seed.email);
      expect(user.emailVerified).toBe(true);
      expect(user.role).toBe(seed.role);
      expect(user.name).toBe(seed.name);
      expect(user.accounts).toHaveLength(1);
      const hash = user.accounts[0]!.password!;
      expect(await verifyPassword({ hash, password: SEED_PASSWORD })).toBe(true);
    }
  });

  it("restores a soft-deleted, banned test account on re-run without duplicating its login", async () => {
    await seedUsers(prisma);
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { deletedAt: new Date(), banned: true },
    });

    const summary = await seedUsers(prisma);

    expect(summary).toEqual({
      dataset: "users",
      rows: SEED_USERS.length,
      created: 0,
      updated: SEED_USERS.length,
      skipped: 0,
    });
    const admin = await findSeedUser(ADMIN_EMAIL);
    expect(admin.deletedAt).toBeNull();
    expect(admin.banned).toBe(false);
    expect(admin.accounts).toHaveLength(1);
    expect(
      await verifyPassword({ hash: admin.accounts[0]!.password!, password: SEED_PASSWORD }),
    ).toBe(true);
  });

  it("counts a test account that did not exist before the run as created", async () => {
    await seedUsers(prisma);
    await prisma.user.delete({ where: { email: ADMIN_EMAIL } });

    const summary = await seedUsers(prisma);

    expect(summary).toEqual({
      dataset: "users",
      rows: SEED_USERS.length,
      created: 1,
      updated: SEED_USERS.length - 1,
      skipped: 0,
    });
    expect((await findSeedUser(ADMIN_EMAIL)).accounts).toHaveLength(1);
  });

  it.each([undefined, "production", "staging"])(
    "creates no test account when NODE_ENV is %s",
    async (nodeEnv) => {
      await prisma.user.deleteMany({ where: { email: { in: SEED_EMAILS } } });

      const summary = await withNodeEnv(nodeEnv, () => seedUsers(prisma));

      expect(summary).toEqual(SKIPPED);
      expect(await prisma.user.count({ where: { email: { in: SEED_EMAILS } } })).toBe(0);
    },
  );

  it("leaves existing test logins untouched when NODE_ENV=production", async () => {
    await seedUsers(prisma);
    const credentialHashes = async () =>
      (
        await prisma.account.findMany({
          where: { providerId: "credential", user: { email: { in: SEED_EMAILS } } },
          orderBy: { id: "asc" },
          select: { id: true, password: true },
        })
      ).map((account) => `${account.id}:${account.password ?? ""}`);
    const before = await credentialHashes();

    expect(await withNodeEnv("production", () => seedUsers(prisma))).toEqual(SKIPPED);

    expect(before).toHaveLength(SEED_USERS.length);
    expect(await credentialHashes()).toEqual(before);
  });
});

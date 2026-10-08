import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createUserRepository } from "../../src/repositories/user.repository";
import type { UserProfileData } from "../../src/repositories/user.repository";
import { isUniqueViolation } from "../../src/utils/errors";
import type { DbClient } from "../../src/utils/transaction";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
  // Profile regions reference the seeded regions; the seed is idempotent and safe in parallel.
  await seedSourceRegions(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Each test gets its own name prefix so it can scope queries to the rows it created. */
const group = () => `group-${crypto.randomUUID()}`;

const createUser = (
  data: {
    group: string;
    role?: string;
    index?: number;
    kana?: { lastNameKana: string; firstNameKana: string };
  },
  db: DbClient = prisma,
) =>
  db.user.create({
    data: {
      name: `${data.group} ${String(data.index ?? 0)}`,
      email: `${crypto.randomUUID()}@example.com`,
      role: data.role ?? "am",
      ...data.kana,
    },
  });

const inGroup = (prefix: string) => ({ name: { startsWith: prefix } });

/** 社員番号 is unique across the shared container: every profile gets a random one. */
const profileData = (overrides: Partial<UserProfileData> = {}): UserProfileData => ({
  employeeNumber: 10_000 + Math.floor(Math.random() * 2_000_000_000),
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: null,
  areas: ["EAST"],
  ...overrides,
});

describe("user repository", () => {
  it("excludes soft-deleted users from reads and counts", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    const active = await createUser({ group: prefix });
    const gone = await createUser({ group: prefix });

    await repo.softDelete(gone.id);

    expect(await repo.findById(gone.id)).toBeNull();
    expect((await repo.findByIdIncludingDeleted(gone.id))?.banned).toBe(true);
    expect((await repo.findById(active.id))?.id).toBe(active.id);
    expect(await repo.count(inGroup(prefix))).toBe(1);
    const page = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix));
    expect(page.items.map((u) => u.id)).toEqual([active.id]);
  });

  it("paginates newest first and reports totals", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    for (let i = 0; i < 3; i += 1) {
      await createUser({ group: prefix, index: i });
    }

    const first = await repo.findMany({ page: 1, perPage: 2 }, inGroup(prefix));
    const second = await repo.findMany({ page: 2, perPage: 2 }, inGroup(prefix));

    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(first.hasNext).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasPrev).toBe(true);
    expect(first.items[0]?.name).toBe(`${prefix} 2`);
  });

  it("orders by the requested column", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    for (const index of [2, 0, 1]) {
      await createUser({ group: prefix, index });
    }

    const byNameAsc = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix), {
      orderBy: { name: "asc" },
    });
    const byNameDesc = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix), {
      orderBy: { name: "desc" },
    });

    expect(byNameAsc.items.map((u) => u.name)).toEqual(
      [0, 1, 2].map((i) => `${prefix} ${String(i)}`),
    );
    expect(byNameDesc.items.map((u) => u.name)).toEqual(
      [2, 1, 0].map((i) => `${prefix} ${String(i)}`),
    );
  });

  it("lists only soft-deleted users when asked for them", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    await createUser({ group: prefix });
    const gone = await createUser({ group: prefix });
    await repo.softDelete(gone.id);

    const deactivated = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix), {
      deleted: "only",
    });

    expect(deactivated.total).toBe(1);
    expect(deactivated.items.map((u) => u.id)).toEqual([gone.id]);
  });

  it("restores a soft-deleted user and lifts the deactivation ban", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });
    await repo.softDelete(user.id);

    const restored = await repo.restore(user.id);

    expect(restored.deletedAt).toBeNull();
    expect(restored.banned).toBe(false);
    expect(restored.banReason).toBeNull();
    expect((await repo.findById(user.id))?.id).toBe(user.id);
  });

  it("counts active users of the given admin roles only", async () => {
    // The count is global and other test files create admins in parallel: a RepeatableRead
    // snapshot makes the before/after delta see only the rows this transaction writes.
    await prisma.$transaction(
      async (tx) => {
        const repo = createUserRepository(tx);
        const prefix = group();
        const bothBefore = await repo.countActiveAdmins(["super_admin", "admin"]);
        const adminBefore = await repo.countActiveAdmins(["admin"]);

        await createUser({ group: prefix, role: "super_admin" }, tx);
        await createUser({ group: prefix, role: "admin" }, tx);
        await createUser({ group: prefix, role: "am" }, tx);
        const gone = await createUser({ group: prefix, role: "admin" }, tx);
        await repo.softDelete(gone.id);

        expect(await repo.countActiveAdmins(["super_admin", "admin"])).toBe(bothBefore + 2);
        expect(await repo.countActiveAdmins(["admin"])).toBe(adminBefore + 1);
      },
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("deletes every session of one user and leaves other users' sessions alone", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    const target = await createUser({ group: prefix });
    const other = await createUser({ group: prefix });
    const session = (userId: string) =>
      prisma.session.create({
        data: { userId, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60_000) },
      });
    await session(target.id);
    await session(target.id);
    await session(other.id);

    expect(await repo.deleteSessions(target.id)).toBe(2);

    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: other.id } })).toBe(1);
  });

  it("updates profile fields and role independently", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });

    const updated = await repo.updateProfile(user.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.role).toBe("am");

    const promoted = await repo.updateRole(user.id, "admin");
    expect(promoted.role).toBe("admin");
    expect(promoted.name).toBe("Renamed");
  });

  it("updates the name parts with the display name", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });

    const updated = await repo.updateProfile(user.id, {
      name: "山田 太郎",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    });

    expect(updated).toMatchObject({
      name: "山田 太郎",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    });
  });

  it("tells a user with a password (credential account) from one without", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });
    expect(await repo.hasCredentialAccount(user.id)).toBe(false);

    // An OAuth account is not a password.
    await prisma.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "google" },
    });
    expect(await repo.hasCredentialAccount(user.id)).toBe(false);

    await prisma.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: "hash" },
    });
    expect(await repo.hasCredentialAccount(user.id)).toBe(true);
  });

  it("reads a user with their profile and its regions in code order, and null without one", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    const withProfile = await createUser({ group: prefix, index: 1 });
    const without = await createUser({ group: prefix, index: 0 });
    const data = profileData({ retirementDate: new Date("2027-03-31"), areas: ["EAST", "WEST"] });
    await repo.upsertProfile(withProfile.id, data);
    await repo.replaceProfileRegions(withProfile.id, [7, 4]);

    const found = await repo.findById(withProfile.id);

    expect(found?.profile).toMatchObject({
      employeeNumber: data.employeeNumber,
      departmentName: "東日本営業部",
      position: "SV",
      retirementDate: new Date("2027-03-31"),
      areas: ["EAST", "WEST"],
    });
    expect(found?.profile?.regions.map((region) => region.regionCode)).toEqual([4, 7]);
    expect((await repo.findById(without.id))?.profile).toBeNull();
    const page = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix), {
      orderBy: { name: "asc" },
    });
    expect(page.items.map((user) => user.profile?.employeeNumber ?? null)).toEqual([
      null,
      data.employeeNumber,
    ]);
  });

  it("creates the profile once and updates it in place", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });
    const created = await repo.upsertProfile(user.id, profileData());

    const updated = await repo.upsertProfile(
      user.id,
      profileData({ departmentName: "西日本営業部", position: "LEADER", areas: ["WEST"] }),
    );

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({
      departmentName: "西日本営業部",
      position: "LEADER",
      areas: ["WEST"],
    });
    expect(await prisma.userProfile.count({ where: { userId: user.id } })).toBe(1);
  });

  it("replaces the profile regions with exactly the given codes", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });
    await repo.upsertProfile(user.id, profileData());
    await repo.replaceProfileRegions(user.id, [3, 4]);

    await repo.replaceProfileRegions(user.id, [4, 5]);

    const regions = await prisma.userProfileRegion.findMany({
      where: { userId: user.id },
      orderBy: { regionCode: "asc" },
    });
    expect(regions.map((region) => region.regionCode)).toEqual([4, 5]);
  });

  it("refuses a second profile with the same 社員番号", async () => {
    const repo = createUserRepository(prisma);
    const first = await createUser({ group: group() });
    const second = await createUser({ group: group() });
    const data = profileData();
    await repo.upsertProfile(first.id, data);

    await expect(repo.upsertProfile(second.id, data)).rejects.toSatisfy(isUniqueViolation);
  });

  it("counts the profiles holding a 社員番号, leaving out one user's own", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });
    const data = profileData();
    await repo.upsertProfile(user.id, data);

    expect(await repo.countProfilesByEmployeeNumber(data.employeeNumber)).toBe(1);
    expect(await repo.countProfilesByEmployeeNumber(data.employeeNumber, user.id)).toBe(0);
    expect(await repo.countProfilesByEmployeeNumber(data.employeeNumber + 1)).toBe(0);
  });

  it("lists charger options in kana order, users without kana last, deactivated users never", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    const tanaka = await createUser({
      group: prefix,
      index: 1,
      kana: { lastNameKana: "タナカ", firstNameKana: "ミサキ" },
    });
    const noKana = await createUser({ group: prefix, index: 0 });
    const sato = await createUser({
      group: prefix,
      index: 2,
      kana: { lastNameKana: "サトウ", firstNameKana: "イチロウ" },
    });
    const gone = await createUser({
      group: prefix,
      index: 3,
      kana: { lastNameKana: "アベ", firstNameKana: "タロウ" },
    });
    await repo.softDelete(gone.id);

    const options = await repo.findChargerOptions(inGroup(prefix), 10);

    expect(options.map((option) => option.id)).toEqual([sato.id, tanaka.id, noKana.id]);
    expect(options[0]).toEqual({
      id: sato.id,
      name: `${prefix} 2`,
      lastName: null,
      firstName: null,
      lastNameKana: "サトウ",
      firstNameKana: "イチロウ",
    });
    expect(await repo.findChargerOptions(inGroup(prefix), 1)).toHaveLength(1);
  });

  it("marks the email verified once and reports whether it changed", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });

    expect(await repo.markEmailVerified(user.id)).toBe(true);
    expect(await repo.markEmailVerified(user.id)).toBe(false);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.emailVerified).toBe(true);
  });
});

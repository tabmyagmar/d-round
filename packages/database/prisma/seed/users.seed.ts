// Development test accounts, seeded by prisma/seed/index.ts (`yarn db:seed`). Created only when
// NODE_ENV is explicitly `development` or `test`; anything else (unset, `production`, `staging`)
// skips them, because accounts with a known password must never reach a real environment.
// Converges rather than no-ops: users are upserted by email, so a re-run re-applies the fixtures
// (fresh password hash) without duplicating them.
//
// Test accounts (all verified, password `A12345678`), one per role of roles.seed.ts:
//   super_admin@test.com  super_admin
//   admin@test.com        admin
//   manager@test.com      manager
//   am@test.com           am
//
// Passwords are hashed with Better Auth's own scrypt implementation so the accounts sign in
// through the normal /api/auth/sign-in/email flow. Each account also gets a 担当者 profile
// (ADR 0007) whose regions reference the regions seed, which index.ts runs first.
import { hashPassword } from "better-auth/crypto";

import type { Position, SourceArea } from "../../src/index";

import type { RoleKey } from "./roles.seed";
import type { SeedFn } from "./support";

export const SEED_PASSWORD = "A12345678";

type SeedProfile = {
  employeeNumber: number;
  departmentName: string;
  position: Position;
  areas: SourceArea[];
  regionCodes: number[];
};

type SeedUser = {
  email: string;
  /** "姓 名", Better Auth's display name, as the user service writes it. */
  name: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  role: RoleKey;
  profile: SeedProfile;
};

const seedUser = (
  email: string,
  role: RoleKey,
  [lastName, firstName]: readonly [string, string],
  [lastNameKana, firstNameKana]: readonly [string, string],
  profile: SeedProfile,
): SeedUser => ({
  email,
  name: `${lastName} ${firstName}`,
  lastName,
  firstName,
  lastNameKana,
  firstNameKana,
  role,
  profile,
});

export const SEED_USERS: readonly SeedUser[] = [
  seedUser("super_admin@test.com", "super_admin", ["佐藤", "一郎"], ["サトウ", "イチロウ"], {
    employeeNumber: 1,
    departmentName: "本社",
    position: "EXECUTIVE",
    areas: ["EAST", "WEST"],
    regionCodes: [4, 7],
  }),
  seedUser("admin@test.com", "admin", ["鈴木", "花子"], ["スズキ", "ハナコ"], {
    employeeNumber: 2,
    departmentName: "本社",
    position: "AREA_MANAGER",
    areas: ["EAST"],
    regionCodes: [3, 4],
  }),
  seedUser("manager@test.com", "manager", ["高橋", "次郎"], ["タカハシ", "ジロウ"], {
    employeeNumber: 3,
    departmentName: "東日本営業部",
    position: "DISTRICT_MANAGER",
    areas: ["EAST"],
    regionCodes: [4],
  }),
  seedUser("am@test.com", "am", ["田中", "美咲"], ["タナカ", "ミサキ"], {
    employeeNumber: 4,
    departmentName: "東日本営業部",
    position: "SV",
    areas: ["EAST"],
    regionCodes: [4],
  }),
];

const CREDENTIAL_PROVIDER = "credential";

/** Fail closed: only these environments get the known-password accounts. */
const TEST_USER_ENVIRONMENTS = new Set(["development", "test"]);

export const seedUsers: SeedFn = async (prisma) => {
  if (!TEST_USER_ENVIRONMENTS.has(process.env.NODE_ENV ?? "")) {
    return {
      dataset: "users",
      rows: SEED_USERS.length,
      created: 0,
      updated: 0,
      skipped: SEED_USERS.length,
    };
  }
  const password = await hashPassword(SEED_PASSWORD);
  const existing = await prisma.user.findMany({
    where: { email: { in: SEED_USERS.map((seed) => seed.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((user) => user.email));

  for (const seed of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        name: seed.name,
        lastName: seed.lastName,
        firstName: seed.firstName,
        lastNameKana: seed.lastNameKana,
        firstNameKana: seed.firstNameKana,
        role: seed.role,
        emailVerified: true,
        banned: false,
        banReason: null,
        deletedAt: null,
      },
      create: {
        email: seed.email,
        name: seed.name,
        lastName: seed.lastName,
        firstName: seed.firstName,
        lastNameKana: seed.lastNameKana,
        firstNameKana: seed.firstNameKana,
        role: seed.role,
        emailVerified: true,
      },
    });

    const { regionCodes, ...profile } = seed.profile;
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { ...profile, retirementDate: null },
      create: { userId: user.id, ...profile },
    });
    await prisma.userProfileRegion.deleteMany({ where: { userId: user.id } });
    await prisma.userProfileRegion.createMany({
      data: regionCodes.map((regionCode) => ({ userId: user.id, regionCode })),
    });

    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
    });
    if (account) {
      await prisma.account.update({ where: { id: account.id }, data: { password } });
    } else {
      await prisma.account.create({
        data: { userId: user.id, providerId: CREDENTIAL_PROVIDER, accountId: user.id, password },
      });
    }
  }

  const created = SEED_USERS.filter((seed) => !existingEmails.has(seed.email)).length;
  return {
    dataset: "users",
    rows: SEED_USERS.length,
    created,
    updated: SEED_USERS.length - created,
    skipped: 0,
  };
};

// Development test accounts, seeded by prisma/seed/index.ts (`yarn db:seed`) only — the
// production-safe reference seed never imports this file. Converges rather than no-ops: users are
// upserted by email, so a re-run re-applies the fixtures (fresh password hash) without duplicating
// them. Refuses to run with NODE_ENV=production, however it is started.
//
// Test accounts (all verified, password `A12345678`):
//   admin@test.com   admin
//   member@test.com  member
//
// Passwords are hashed with Better Auth's own scrypt implementation so the accounts sign in
// through the normal /api/auth/sign-in/email flow. Never run this against production data.
import { hashPassword } from "better-auth/crypto";

import { assertNotProduction } from "./support";
import type { SeedFn } from "./support";

export const SEED_PASSWORD = "A12345678";

export const SEED_USERS = [
  { email: "admin@test.com", name: "Admin Test", role: "admin" },
  { email: "member@test.com", name: "Member Test", role: "member" },
] as const;

const CREDENTIAL_PROVIDER = "credential";

export const seedUsers: SeedFn = async (prisma) => {
  assertNotProduction(process.env);
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
        role: seed.role,
        emailVerified: true,
        banned: false,
        banReason: null,
        deletedAt: null,
      },
      create: {
        email: seed.email,
        name: seed.name,
        role: seed.role,
        emailVerified: true,
      },
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

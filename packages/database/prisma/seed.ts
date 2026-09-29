// Development seed — `yarn db:seed` (prisma db seed → tsx prisma/seed.ts). Idempotent: users are
// upserted by email, so running it again only refreshes them.
//
// Test accounts (all verified, password `A12345678`):
//   admin@test.com   admin
//   member@test.com  member
//
// Passwords are hashed with Better Auth's own scrypt implementation so the accounts sign in
// through the normal /api/auth/sign-in/email flow. Never run this against production data.
import { hashPassword } from "better-auth/crypto";

import { createPrismaClient } from "../src/client";
import type { PrismaClient } from "../src/client";

export const SEED_PASSWORD = "A12345678";

export const SEED_USERS = [
  { email: "admin@test.com", name: "Admin Test", role: "admin" },
  { email: "member@test.com", name: "Member Test", role: "member" },
] as const;

const CREDENTIAL_PROVIDER = "credential";

export const seedUsers = async (prisma: PrismaClient): Promise<void> => {
  const password = await hashPassword(SEED_PASSWORD);

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
};

const main = async (): Promise<void> => {
  // `prisma db seed` inherits the env loaded by prisma.config.ts (root .env).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; seeding needs a database");
  }
  const prisma = createPrismaClient({ connectionString });
  try {
    await seedUsers(prisma);
    process.stdout.write(
      `seed: ${String(SEED_USERS.length)} test users ready (password ${SEED_PASSWORD}): ${SEED_USERS.map((u) => u.email).join(", ")}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

await main();

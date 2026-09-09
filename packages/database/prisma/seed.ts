// Seed placeholder — run with `yarn db:seed` (prisma db seed → tsx prisma/seed.ts).
// There is no admin seed yet: promote the first user with SQL (see README, "Phase 1 walkthrough").
// Keep seeds idempotent (upsert, never insert).
import { createPrismaClient } from "../src/client";

const main = async (): Promise<void> => {
  // `prisma db seed` inherits the env loaded by prisma.config.ts (root .env).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; seeding needs a database");
  }
  const prisma = createPrismaClient({ connectionString });
  try {
    const count = await prisma.healthCheck.count();
    process.stdout.write(`seed: nothing to do (health_checks rows: ${String(count)})\n`);
  } finally {
    await prisma.$disconnect();
  }
};

await main();

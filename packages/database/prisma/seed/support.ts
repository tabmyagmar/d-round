// Shared plumbing for the seed entrypoints: prisma/seed/index.ts (`yarn db:seed`, development
// only) and prisma/seed/reference.ts (`yarn db:seed:reference`, production-safe). Each dataset
// is a SeedFn that returns a SeedSummary; runSeeds owns the connection and the output.
import { config as loadEnv } from "dotenv";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

export type SeedSummary = {
  dataset: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
};

export type SeedFn = (prisma: PrismaClient) => Promise<SeedSummary>;

/**
 * Loads the monorepo's root .env, same rule as prisma.config.ts: existing process env wins. Call it
 * before reading process.env in an entrypoint; runSeeds calls it itself.
 */
export const loadSeedEnv = (): void => {
  loadEnv({ path: new URL("../../../../.env", import.meta.url), quiet: true });
};

/** The dev seed creates test users with a known password; production gets reference data only. */
export const assertNotProduction = (env: NodeJS.ProcessEnv): void => {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "yarn db:seed creates test users and must not run with NODE_ENV=production; " +
        "use yarn db:seed:reference for reference data",
    );
  }
};

const formatSummary = (label: string, summary: SeedSummary): string =>
  `seed:${label} ${summary.dataset}: rows ${summary.rows}, created ${summary.created}, ` +
  `updated ${summary.updated}, skipped ${summary.skipped}\n`;

export const runSeeds = async (
  label: string,
  run: (prisma: PrismaClient) => Promise<readonly SeedSummary[]>,
): Promise<void> => {
  loadSeedEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; seeding needs a database");
  }
  const prisma = createPrismaClient({ connectionString });
  try {
    const summaries = await run(prisma);
    for (const summary of summaries) {
      process.stdout.write(formatSummary(label, summary));
    }
  } finally {
    await prisma.$disconnect();
  }
};

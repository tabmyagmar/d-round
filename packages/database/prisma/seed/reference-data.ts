// Production-safe reference datasets, run in registry order (parents before children). Nothing
// registered here may create test users: the `database/seed-production-safe` lint rule in
// packages/database/eslint.config.mjs forbids importing users.seed or better-auth in this folder.
import type { PrismaClient } from "../../src/client";

import { seedSourcePrefectures } from "./source-prefectures.seed";
import { seedSourceRegions } from "./source-regions.seed";
import type { SeedFn, SeedSummary } from "./support";

export const REFERENCE_SEEDS: readonly SeedFn[] = [seedSourceRegions, seedSourcePrefectures];

export const seedReferenceData = async (prisma: PrismaClient): Promise<SeedSummary[]> => {
  const summaries: SeedSummary[] = [];
  for (const seed of REFERENCE_SEEDS) {
    summaries.push(await seed(prisma));
  }
  return summaries;
};

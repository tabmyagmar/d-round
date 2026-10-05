// Shared plumbing for prisma/seed/index.ts (`yarn db:seed`). Each dataset is a SeedFn that returns
// a SeedSummary; runSeeds owns the connection and the output. CSV datasets build on readCsv,
// parseInteger and diffByKey.
import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";
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

/** Reads a CSV with a header row into one object per row, keyed by column; cells are trimmed. */
export const readCsv = <T extends Record<string, string>>(file: URL): T[] =>
  parse<T>(readFileSync(file), { columns: true, skip_empty_lines: true, bom: true, trim: true });

/** Strict integer cell: "12" → 12, while "", "1.5" or "12a" throw instead of being truncated. */
export const parseInteger = (value: string, column: string): number => {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Expected an integer in column "${column}", got "${value}"`);
  }
  return Number.parseInt(value, 10);
};

/**
 * Splits the desired rows into those missing from `existing` (by key) and those whose values
 * differ, so a seed writes only what changed and a re-run leaves every `updated_at` alone.
 */
export const diffByKey = <T>(
  existing: readonly T[],
  desired: readonly T[],
  keyOf: (row: T) => string | number,
  isSame: (a: T, b: T) => boolean,
): { toCreate: T[]; toUpdate: T[] } => {
  const existingByKey = new Map(existing.map((row) => [keyOf(row), row]));
  const toCreate: T[] = [];
  const toUpdate: T[] = [];
  for (const row of desired) {
    const current = existingByKey.get(keyOf(row));
    if (current === undefined) {
      toCreate.push(row);
    } else if (!isSame(current, row)) {
      toUpdate.push(row);
    }
  }
  return { toCreate, toUpdate };
};

const formatSummary = (summary: SeedSummary): string =>
  `seed ${summary.dataset}: rows ${summary.rows}, created ${summary.created}, ` +
  `updated ${summary.updated}, skipped ${summary.skipped}\n`;

export const runSeeds = async (
  run: (prisma: PrismaClient) => Promise<readonly SeedSummary[]>,
): Promise<void> => {
  // Same rule as prisma.config.ts: one root .env for the monorepo, existing process env wins.
  loadEnv({ path: new URL("../../../../.env", import.meta.url), quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; seeding needs a database");
  }
  const prisma = createPrismaClient({ connectionString });
  try {
    const summaries = await run(prisma);
    for (const summary of summaries) {
      process.stdout.write(formatSummary(summary));
    }
  } finally {
    await prisma.$disconnect();
  }
};

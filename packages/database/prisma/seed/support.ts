// Shared plumbing for prisma/seed/index.ts (`yarn db:seed`). Each dataset is a SeedFn that returns
// a SeedSummary; runSeeds owns the connection and the output. CSV datasets build on readCsv,
// parseInteger and diffByKey; large ones insert in slices from chunk.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";

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
  /** Join-table rows a dataset syncs next to its own rows; printed as `grants +created/-deleted`. */
  grants?: { created: number; deleted: number };
};

export type SeedFn = (prisma: PrismaClient) => Promise<SeedSummary>;

/** File contents, gunzipped when the name ends in `.gz` (large datasets are stored compressed). */
const readCsvBytes = (file: URL): Buffer => {
  const bytes = readFileSync(file);
  return file.pathname.endsWith(".gz") ? gunzipSync(bytes) : bytes;
};

/**
 * Reads a CSV (plain, or gzip-compressed when the name ends in `.gz`) whose header must be exactly
 * `columns` (same names, same order) into one object per row; cells are trimmed. A renamed or
 * missing column throws instead of yielding undefined cells.
 */
export const readCsv = <const C extends readonly string[]>(
  file: URL,
  columns: C,
): Record<C[number], string>[] =>
  // The header check below guarantees every row has exactly the keys in `columns`.
  parse<Record<string, string>>(readCsvBytes(file), {
    columns: (header: string[]) => {
      if (header.join(",") !== columns.join(",")) {
        throw new Error(
          `${basename(file.pathname)}: expected columns ${columns.join(",")}, got ${header.join(",")}`,
        );
      }
      return header;
    },
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

/** Strict integer cell: "12" → 12, while "", "1.5" or "12a" throw instead of being truncated. */
export const parseInteger = (value: string, column: string): number => {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Expected an integer in column "${column}", got "${value}"`);
  }
  return Number.parseInt(value, 10);
};

/** Strict 0/1 flag cell: "1" → true, "0" → false, while "", "2" or "true" throw. */
export const parseFlag = (value: string, column: string): boolean => {
  if (value === "1") {
    return true;
  }
  if (value === "0") {
    return false;
  }
  throw new Error(`Expected "0" or "1" in column "${column}", got "${value}"`);
};

/** Optional text cell: "" → null, any other value unchanged. */
export const emptyToNull = (value: string): string | null => (value === "" ? null : value);

/** Consecutive slices of `size` items, the last one possibly shorter; `size` >= 1, an integer. */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`chunk: size must be a positive integer, got ${String(size)}`);
  }
  const slices: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    slices.push(items.slice(start, start + size));
  }
  return slices;
};

/**
 * Splits the desired rows into those missing from `existing` (by key) and those whose values
 * differ, so a seed writes only what changed and a re-run leaves every `updated_at` alone. A key
 * repeated in `desired` throws: such a dataset would never settle.
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
  const seen = new Set<string | number>();
  for (const row of desired) {
    const key = keyOf(row);
    if (seen.has(key)) {
      throw new Error(`diffByKey: duplicate key ${String(key)} in the desired rows`);
    }
    seen.add(key);
    const current = existingByKey.get(key);
    if (current === undefined) {
      toCreate.push(row);
    } else if (!isSame(current, row)) {
      toUpdate.push(row);
    }
  }
  return { toCreate, toUpdate };
};

const formatSummary = (summary: SeedSummary): string => {
  const grants = summary.grants
    ? `, grants +${summary.grants.created}/-${summary.grants.deleted}`
    : "";
  return (
    `seed ${summary.dataset}: rows ${summary.rows}, created ${summary.created}, ` +
    `updated ${summary.updated}, skipped ${summary.skipped}${grants}\n`
  );
};

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

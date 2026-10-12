import { CSV_CHECK_INTERRUPTED, CSV_IMPORT_INTERRUPTED } from "@repo/api/jobs";
import { createCsvImportRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import {
  QUEUE_NAMES,
  createQueue,
  createWorker,
  enqueueCsvCheckJob,
  enqueueCsvImportJob,
} from "@repo/queue";
import type { CsvImportQueue, RedisConnection, TypedQueue, TypedWorker } from "@repo/queue";

/**
 * Keeps CSV imports moving (docs/adr/0013-csv-import.md). Every `CSV_IMPORT_SWEEP_INTERVAL_MS`: an
 * UPLOADED or CONFIRMED import older than `CSV_IMPORT_SWEEP_GRACE_MS` lost its job (a crash between
 * commit and enqueue, a Redis flush) and is enqueued again with the same id; a CHECKING or
 * IMPORTING import without progress for `CSV_IMPORT_STALE_MS` was stopped (BullMQ gave up on a
 * stalled job) and is failed with a reason — an import is never run twice.
 */

export type CsvImportSweepJob = Record<string, never>;

export const CSV_IMPORT_SWEEP_INTERVAL_MS = 2 * 60_000;
export const CSV_IMPORT_SWEEP_GRACE_MS = 60_000;
export const CSV_IMPORT_STALE_MS = 10 * 60_000;
export const CSV_IMPORT_SWEEP_BATCH = 100;
export const CSV_IMPORT_SWEEP_SCHEDULER_ID = "csv-import-sweeper";

export type CsvImportSweepDeps = {
  db: PrismaClient;
  csvImportQueue: CsvImportQueue;
  logger: Logger;
  now?: () => Date;
};

export type CsvImportSweepResult = { requeued: number; failed: number };

/** One sweep: how many lost jobs were enqueued again and how many stopped imports failed. */
export const sweepCsvImports = async (deps: CsvImportSweepDeps): Promise<CsvImportSweepResult> => {
  const now = (deps.now?.() ?? new Date()).getTime();
  const imports = createCsvImportRepository(deps.db);
  const lostBefore = new Date(now - CSV_IMPORT_SWEEP_GRACE_MS);
  const stoppedBefore = new Date(now - CSV_IMPORT_STALE_MS);

  const [uploaded, confirmed, checking, importing] = await Promise.all([
    imports.findStale("UPLOADED", lostBefore, CSV_IMPORT_SWEEP_BATCH),
    imports.findStale("CONFIRMED", lostBefore, CSV_IMPORT_SWEEP_BATCH),
    imports.findStale("CHECKING", stoppedBefore, CSV_IMPORT_SWEEP_BATCH),
    imports.findStale("IMPORTING", stoppedBefore, CSV_IMPORT_SWEEP_BATCH),
  ]);
  for (const csvImport of uploaded) {
    await enqueueCsvCheckJob(deps.csvImportQueue, csvImport.id);
  }
  for (const csvImport of confirmed) {
    await enqueueCsvImportJob(deps.csvImportQueue, csvImport.id);
  }
  let failed = 0;
  for (const csvImport of checking) {
    failed += (await imports.markFailed(csvImport.id, "CHECKING", CSV_CHECK_INTERRUPTED)) ? 1 : 0;
  }
  for (const csvImport of importing) {
    failed += (await imports.markFailed(csvImport.id, "IMPORTING", CSV_IMPORT_INTERRUPTED)) ? 1 : 0;
  }

  const requeued = uploaded.length + confirmed.length;
  if (requeued > 0) {
    deps.logger.warn({ requeued }, "csv import sweeper enqueued lost jobs again");
  }
  if (failed > 0) {
    // A worker stopped in the middle of a file: someone should look.
    deps.logger.error({ failed }, "csv import sweeper failed stopped imports");
  }
  return { requeued, failed };
};

export const createCsvImportSweeperQueue = (
  connection: RedisConnection,
): TypedQueue<CsvImportSweepJob> =>
  createQueue<CsvImportSweepJob>(QUEUE_NAMES.csvImportSweeper, connection);

/** Registers (idempotently) the repeatable sweep job — BullMQ 6 job scheduler. */
export const registerCsvImportSweeper = (
  queue: TypedQueue<CsvImportSweepJob>,
  everyMs = CSV_IMPORT_SWEEP_INTERVAL_MS,
) => queue.upsertJobScheduler(CSV_IMPORT_SWEEP_SCHEDULER_ID, { every: everyMs }, { name: "sweep" });

export const createCsvImportSweeperWorker = (
  deps: CsvImportSweepDeps & { connection: RedisConnection; queueName?: string },
): TypedWorker<CsvImportSweepJob, CsvImportSweepResult> =>
  createWorker<CsvImportSweepJob, CsvImportSweepResult>(
    deps.queueName ?? QUEUE_NAMES.csvImportSweeper,
    () => sweepCsvImports(deps),
    deps.connection,
    { concurrency: 1, logger: deps.logger },
  );

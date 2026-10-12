import type { RedisConnection } from "../connection";
import { jobIdFor } from "../job-id";
import { QUEUE_NAMES } from "../names";
import { createQueue } from "../queue";
import type { TypedQueue } from "../queue";

/**
 * CSV import jobs shared by the producer (apps/api csv-import service, after commit; the sweeper)
 * and the consumer (apps/worker csv-import.processor). The payload carries the import's id only:
 * the runner re-reads the row, which is the truth (docs/adr/0013-csv-import.md).
 */
export type CsvImportJob = {
  csvImportId: string;
  /** The request that uploaded or confirmed the file (`ctx.requestId`), for the worker's logs. */
  traceId?: string;
};

/** Reads the stored file and records each row's errors (UPLOADED → CHECKED). */
export const CSV_CHECK_JOB_NAME = "check";
/** Writes the confirmed rows one by one (CONFIRMED → IMPORTED). */
export const CSV_IMPORT_JOB_NAME = "import";

export const csvCheckJobId = (csvImportId: string): string => jobIdFor("csv-check", csvImportId);
export const csvImportJobId = (csvImportId: string): string => jobIdFor("csv-import", csvImportId);

export type CsvImportQueue = TypedQueue<CsvImportJob>;

/**
 * A job that failed every attempt is dropped at once (`removeOnFail`): the import row is the record
 * (FAILED, `last_error`), and the sweeper's re-enqueue of an UPLOADED or CONFIRMED import under the
 * same id must not collide with a kept failed job.
 */
export const createCsvImportQueue = (connection: RedisConnection): CsvImportQueue =>
  createQueue<CsvImportJob>(QUEUE_NAMES.csvImport, connection, {
    defaultJobOptions: { removeOnFail: true },
  });

const payloadOf = (csvImportId: string, traceId?: string): CsvImportJob =>
  traceId ? { csvImportId, traceId } : { csvImportId };

/** Producers call this AFTER the transaction that created the UPLOADED import committed. */
export const enqueueCsvCheckJob = (queue: CsvImportQueue, csvImportId: string, traceId?: string) =>
  queue.add(CSV_CHECK_JOB_NAME, payloadOf(csvImportId, traceId), {
    jobId: csvCheckJobId(csvImportId),
  });

/**
 * Producers call this AFTER the transaction that confirmed the import committed. One attempt: a
 * retry would run rows that were already written (an interrupted import fails, ADR 0013).
 */
export const enqueueCsvImportJob = (queue: CsvImportQueue, csvImportId: string, traceId?: string) =>
  queue.add(CSV_IMPORT_JOB_NAME, payloadOf(csvImportId, traceId), {
    jobId: csvImportJobId(csvImportId),
    attempts: 1,
  });

import { runCsvCheck, runCsvImport } from "@repo/api/jobs";
import type { JobDeps } from "@repo/api/jobs";
import { CSV_IMPORT_JOB_NAME, QUEUE_NAMES, UnrecoverableError, createWorker } from "@repo/queue";
import type { CsvImportJob, Job, RedisConnection, TypedWorker } from "@repo/queue";

export type CsvImportProcessorDeps = JobDeps & {
  connection: RedisConnection;
  /** Override for tests (isolated queues); production uses QUEUE_NAMES.csvImport. */
  queueName?: string;
};

/** Two imports at once (romuten-v3's concurrency); each writes its rows one after another. */
export const CSV_IMPORT_WORKER_CONCURRENCY = 2;

/**
 * Runs the CSV jobs (docs/adr/0013-csv-import.md). Their rules live in the API's services, so the
 * runners come from `@repo/api/jobs`; the processor only picks the runner and tells it whether
 * BullMQ will try the job again.
 */
export const processCsvImportJob = async (deps: JobDeps, job: Job<CsvImportJob>): Promise<void> => {
  const input = {
    csvImportId: job.data.csvImportId,
    traceId: job.data.traceId,
    jobId: job.id,
    lastAttempt: job.attemptsStarted >= (job.opts.attempts ?? 1),
  };
  const outcome =
    job.name === CSV_IMPORT_JOB_NAME
      ? await runCsvImport(deps, input)
      : await runCsvCheck(deps, input);
  if (outcome === "missing") {
    // The producer enqueues after commit, so a missing import was deleted on purpose.
    throw new UnrecoverableError(`CsvImport ${job.data.csvImportId} not found`);
  }
};

export const createCsvImportWorker = (deps: CsvImportProcessorDeps): TypedWorker<CsvImportJob> =>
  createWorker<CsvImportJob>(
    deps.queueName ?? QUEUE_NAMES.csvImport,
    (job) => processCsvImportJob(deps, job),
    deps.connection,
    { concurrency: CSV_IMPORT_WORKER_CONCURRENCY, logger: deps.logger },
  );

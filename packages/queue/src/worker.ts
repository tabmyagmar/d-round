import { Worker } from "bullmq";
import type { Job, WorkerOptions } from "bullmq";

import type { RedisConnection } from "./connection";

export type JobProcessor<TPayload, TResult = void> = (
  job: Job<TPayload, TResult>,
) => Promise<TResult>;

export type TypedWorker<TPayload, TResult = void> = Worker<TPayload, TResult>;

/** Minimal logger contract so this package does not depend on a concrete logger. */
export type WorkerLogger = {
  error: (bindings: Record<string, unknown>, message: string) => void;
  info: (bindings: Record<string, unknown>, message: string) => void;
};

export type CreateWorkerOptions = Omit<WorkerOptions, "connection"> & {
  logger?: WorkerLogger;
};

/**
 * Workers live ONLY in apps/worker. Processors must be idempotent: re-read state from the
 * database and no-op when the work was already done (jobs can be retried or re-enqueued
 * by the sweeper). Concurrency defaults to 1; raise it per queue deliberately.
 */
export const createWorker = <TPayload, TResult = void>(
  name: string,
  processor: JobProcessor<TPayload, TResult>,
  connection: RedisConnection,
  options: CreateWorkerOptions = {},
): TypedWorker<TPayload, TResult> => {
  const { logger, ...workerOptions } = options;
  const worker = new Worker<TPayload, TResult, string>(name, processor, {
    concurrency: 1,
    ...workerOptions,
    connection,
  });

  if (logger) {
    worker.on("failed", (job, error) => {
      logger.error(
        {
          queue: name,
          jobId: job?.id,
          attemptsMade: job?.attemptsMade,
          traceId: (job?.data as { traceId?: string } | undefined)?.traceId,
          err: error,
        },
        "job failed",
      );
    });
    worker.on("error", (error) => {
      logger.error({ queue: name, err: error }, "worker error");
    });
    worker.on("completed", (job) => {
      logger.info(
        { queue: name, jobId: job.id, traceId: (job.data as { traceId?: string }).traceId },
        "job completed",
      );
    });
  }

  return worker;
};

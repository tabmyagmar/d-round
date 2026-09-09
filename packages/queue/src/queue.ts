import { Queue } from "bullmq";
import type { DefaultJobOptions, QueueOptions } from "bullmq";

import type { RedisConnection } from "./connection";

const ONE_HOUR_SECONDS = 60 * 60;
const ONE_DAY_SECONDS = 24 * ONE_HOUR_SECONDS;

/**
 * Retry 5 times with exponential backoff (3s, 6s, 12s, 24s, 48s). Completed jobs are kept
 * for a day (max 1000) for debugging; failed jobs for a week so they can be inspected and
 * re-driven. Because failed jobs are eventually removed while their deterministic jobId
 * stays the same, durable failure state must live in the DB row (outbox FAILED status).
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 3000 },
  removeOnComplete: { age: ONE_DAY_SECONDS, count: 1000 },
  removeOnFail: { age: 7 * ONE_DAY_SECONDS },
} as const satisfies DefaultJobOptions;

export type TypedQueue<TPayload> = Queue<TPayload, void>;

export type CreateQueueOptions = Omit<QueueOptions, "connection">;

/**
 * Payloads carry IDs only — the worker re-reads the row and decides what to do.
 * Producers call `queue.add(name, payload, { jobId: jobIdFor(prefix, id) })` AFTER the
 * database transaction has committed.
 */
export const createQueue = <TPayload>(
  name: string,
  connection: RedisConnection,
  options: CreateQueueOptions = {},
): TypedQueue<TPayload> =>
  new Queue<TPayload, void, string>(name, {
    ...options,
    connection,
    defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...options.defaultJobOptions },
  });

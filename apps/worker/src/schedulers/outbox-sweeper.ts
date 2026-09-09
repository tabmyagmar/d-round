import { createOutboxEmailRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, createQueue, createWorker, enqueueEmailJob } from "@repo/queue";
import type { EmailQueue, RedisConnection, TypedQueue, TypedWorker } from "@repo/queue";

/**
 * Safety net for the outbox: a job can be lost between commit and enqueue (crash, Redis
 * flush, failed after-commit hook). Every `OUTBOX_SWEEP_INTERVAL_MS` the sweeper re-enqueues
 * rows still PENDING after `OUTBOX_SWEEP_GRACE_MS`, with the same deterministic job ids, so
 * duplicates collapse. FAILED rows are never touched (docs/adr/0004-outbox.md).
 */

export type SweepJob = Record<string, never>;

export const OUTBOX_SWEEP_INTERVAL_MS = 2 * 60_000;
export const OUTBOX_SWEEP_GRACE_MS = 60_000;
export const OUTBOX_SWEEP_BATCH = 200;
export const OUTBOX_SWEEP_SCHEDULER_ID = "outbox-email-sweeper";

export type SweepDeps = {
  db: PrismaClient;
  emailQueue: EmailQueue;
  logger: Logger;
  graceMs?: number;
  now?: () => Date;
};

/** One sweep. Returns the number of rows re-enqueued. */
export const sweepOutboxEmails = async (deps: SweepDeps): Promise<number> => {
  const now = deps.now?.() ?? new Date();
  const olderThan = new Date(now.getTime() - (deps.graceMs ?? OUTBOX_SWEEP_GRACE_MS));
  const stale = await createOutboxEmailRepository(deps.db).findStalePending(
    olderThan,
    OUTBOX_SWEEP_BATCH,
  );

  for (const row of stale) {
    await enqueueEmailJob(deps.emailQueue, row.id);
  }
  if (stale.length > 0) {
    deps.logger.warn({ count: stale.length }, "outbox sweeper re-enqueued pending emails");
  }
  return stale.length;
};

export const createOutboxSweeperQueue = (connection: RedisConnection): TypedQueue<SweepJob> =>
  createQueue<SweepJob>(QUEUE_NAMES.outboxSweeper, connection);

/** Registers (idempotently) the repeatable sweep job — BullMQ 6 job scheduler. */
export const registerOutboxSweeper = (
  queue: TypedQueue<SweepJob>,
  everyMs = OUTBOX_SWEEP_INTERVAL_MS,
) => queue.upsertJobScheduler(OUTBOX_SWEEP_SCHEDULER_ID, { every: everyMs }, { name: "sweep" });

export const createOutboxSweeperWorker = (
  deps: SweepDeps & { connection: RedisConnection; queueName?: string },
): TypedWorker<SweepJob, number> =>
  createWorker<SweepJob, number>(
    deps.queueName ?? QUEUE_NAMES.outboxSweeper,
    () => sweepOutboxEmails(deps),
    deps.connection,
    { concurrency: 1, logger: deps.logger },
  );

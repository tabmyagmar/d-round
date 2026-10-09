import { createAttachmentRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, createQueue, createWorker, enqueueAttachmentDeleteJob } from "@repo/queue";
import type { AttachmentDeleteQueue, RedisConnection, TypedQueue, TypedWorker } from "@repo/queue";

/**
 * Cleans the bucket the row way (docs/adr/0012-attachments.md). Every
 * `ATTACHMENT_SWEEP_INTERVAL_MS`: a PENDING row older than `ATTACHMENT_PENDING_TTL_MS` (an upload
 * nobody attached: a form closed without saving) becomes DELETED, and a DELETED row older than
 * `ATTACHMENT_DELETE_GRACE_MS` (its job was lost, or failed every attempt) is enqueued again with
 * the same job id. Rows expired here are enqueued by a later sweep, after the grace period, so a
 * row attached at the same moment is never in a delete job.
 */

export type AttachmentSweepJob = Record<string, never>;

export const ATTACHMENT_SWEEP_INTERVAL_MS = 15 * 60_000;
export const ATTACHMENT_PENDING_TTL_MS = 24 * 60 * 60_000;
export const ATTACHMENT_DELETE_GRACE_MS = 10 * 60_000;
export const ATTACHMENT_SWEEP_BATCH = 200;
export const ATTACHMENT_SWEEP_SCHEDULER_ID = "attachment-sweeper";

export type AttachmentSweepDeps = {
  db: PrismaClient;
  attachmentDeleteQueue: AttachmentDeleteQueue;
  logger: Logger;
  now?: () => Date;
};

export type AttachmentSweepResult = { expired: number; requeued: number };

/** One sweep. Returns how many pending rows expired and how many deletes were enqueued again. */
export const sweepAttachments = async (
  deps: AttachmentSweepDeps,
): Promise<AttachmentSweepResult> => {
  const now = (deps.now?.() ?? new Date()).getTime();
  const attachments = createAttachmentRepository(deps.db);

  const stale = await attachments.findPendingBefore(
    new Date(now - ATTACHMENT_PENDING_TTL_MS),
    ATTACHMENT_SWEEP_BATCH,
  );
  const expired =
    stale.length > 0
      ? await attachments.markDeleted(
          stale.map((row) => row.id),
          "PENDING",
        )
      : 0;

  const lost = await attachments.findDeletedBefore(
    new Date(now - ATTACHMENT_DELETE_GRACE_MS),
    ATTACHMENT_SWEEP_BATCH,
  );
  for (const row of lost) {
    await enqueueAttachmentDeleteJob(deps.attachmentDeleteQueue, row.id);
  }

  if (expired > 0 || lost.length > 0) {
    deps.logger.info({ expired, requeued: lost.length }, "attachment sweeper ran");
  }
  return { expired, requeued: lost.length };
};

export const createAttachmentSweeperQueue = (
  connection: RedisConnection,
): TypedQueue<AttachmentSweepJob> =>
  createQueue<AttachmentSweepJob>(QUEUE_NAMES.attachmentSweeper, connection);

/** Registers (idempotently) the repeatable sweep job — BullMQ 6 job scheduler. */
export const registerAttachmentSweeper = (
  queue: TypedQueue<AttachmentSweepJob>,
  everyMs = ATTACHMENT_SWEEP_INTERVAL_MS,
) => queue.upsertJobScheduler(ATTACHMENT_SWEEP_SCHEDULER_ID, { every: everyMs }, { name: "sweep" });

export const createAttachmentSweeperWorker = (
  deps: AttachmentSweepDeps & { connection: RedisConnection; queueName?: string },
): TypedWorker<AttachmentSweepJob, AttachmentSweepResult> =>
  createWorker<AttachmentSweepJob, AttachmentSweepResult>(
    deps.queueName ?? QUEUE_NAMES.attachmentSweeper,
    () => sweepAttachments(deps),
    deps.connection,
    { concurrency: 1, logger: deps.logger },
  );

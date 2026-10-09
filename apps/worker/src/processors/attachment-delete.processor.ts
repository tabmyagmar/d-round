import { createAttachmentRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, UnrecoverableError, createWorker } from "@repo/queue";
import type { AttachmentDeleteJob, Job, RedisConnection, TypedWorker } from "@repo/queue";
import { PermanentStorageError } from "@repo/storage";
import type { StorageProvider } from "@repo/storage";

export type AttachmentDeleteDeps = {
  connection: RedisConnection;
  db: PrismaClient;
  storage: StorageProvider;
  logger: Logger;
  /** Override for tests (isolated queues); production uses QUEUE_NAMES.attachmentDelete. */
  queueName?: string;
};

/** A handful of deletes a day: two at once keep the bucket calls modest (plan T4). */
export const ATTACHMENT_DELETE_CONCURRENCY = 2;

/**
 * Deletes the object of a DELETED attachment, then its row (docs/adr/0012-attachments.md).
 * Idempotent: a missing row was done already, a row in any other status is left alone, and a
 * missing object counts as deleted. A storage failure throws, so BullMQ retries; after the last
 * attempt the row stays DELETED and the sweeper enqueues it again. A permanent refusal (no role on
 * the bucket, no bucket) fails the job at once: retrying cannot help, and the sweeper tries again
 * every 15 minutes, alerting, until the configuration is fixed — nothing is lost meanwhile.
 */
export const processAttachmentDeleteJob = async (
  deps: Pick<AttachmentDeleteDeps, "db" | "storage" | "logger">,
  job: Job<AttachmentDeleteJob>,
): Promise<void> => {
  const attachments = createAttachmentRepository(deps.db);
  const log = deps.logger.child({
    jobId: job.id,
    attachmentId: job.data.attachmentId,
    traceId: job.data.traceId ?? null,
  });

  const row = await attachments.findById(job.data.attachmentId);
  if (!row) {
    log.info("attachment already removed; nothing to do");
    return;
  }
  if (row.status !== "DELETED") {
    log.warn({ status: row.status }, "attachment is not DELETED; keeping it");
    return;
  }

  try {
    await deps.storage.delete(row.objectKey);
  } catch (error) {
    if (error instanceof PermanentStorageError) {
      log.error(
        { err: error, objectKey: row.objectKey },
        "attachment delete refused by the bucket",
      );
      throw new UnrecoverableError(error.message);
    }
    throw error;
  }
  await attachments.deleteById(row.id);
  log.info({ objectKey: row.objectKey, kind: row.kind }, "attachment deleted");
};

export const createAttachmentDeleteWorker = (
  deps: AttachmentDeleteDeps,
): TypedWorker<AttachmentDeleteJob> =>
  createWorker<AttachmentDeleteJob>(
    deps.queueName ?? QUEUE_NAMES.attachmentDelete,
    (job) => processAttachmentDeleteJob(deps, job),
    deps.connection,
    { concurrency: ATTACHMENT_DELETE_CONCURRENCY, logger: deps.logger },
  );

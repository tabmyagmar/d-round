import { createAttachmentRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, createWorker } from "@repo/queue";
import type { AttachmentDeleteJob, Job, RedisConnection, TypedWorker } from "@repo/queue";
import type { StorageProvider } from "@repo/storage";

export type AttachmentDeleteDeps = {
  connection: RedisConnection;
  db: PrismaClient;
  storage: StorageProvider;
  logger: Logger;
  /** Override for tests (isolated queues); production uses QUEUE_NAMES.attachmentDelete. */
  queueName?: string;
};

export const ATTACHMENT_DELETE_CONCURRENCY = 4;

/**
 * Deletes the object of a DELETED attachment, then its row (docs/adr/0012-attachments.md).
 * Idempotent: a missing row was done already, a row in any other status is left alone, and a
 * missing object counts as deleted. A storage failure throws, so BullMQ retries; after the last
 * attempt the row stays DELETED and the sweeper enqueues it again.
 */
export const processAttachmentDeleteJob = async (
  deps: Pick<AttachmentDeleteDeps, "db" | "storage" | "logger">,
  job: Job<AttachmentDeleteJob>,
): Promise<void> => {
  const attachments = createAttachmentRepository(deps.db);
  const log = deps.logger.child({ jobId: job.id, attachmentId: job.data.attachmentId });

  const row = await attachments.findById(job.data.attachmentId);
  if (!row) {
    log.info("attachment already removed; nothing to do");
    return;
  }
  if (row.status !== "DELETED") {
    log.warn({ status: row.status }, "attachment is not DELETED; keeping it");
    return;
  }

  await deps.storage.delete(row.objectKey);
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

import type { RedisConnection } from "../connection";
import { jobIdFor } from "../job-id";
import { QUEUE_NAMES } from "../names";
import { createQueue } from "../queue";
import type { TypedQueue } from "../queue";

/**
 * Attachment delete job shared by the producers (apps/api attachment.service, the sweeper) and the
 * consumer (apps/worker attachment-delete.processor). The payload carries the row id only; the
 * worker deletes the object of a DELETED row, then the row (docs/adr/0012-attachments.md).
 */
export type AttachmentDeleteJob = {
  attachmentId: string;
  /** The request that dropped the file (`ctx.requestId`), for the worker's log lines. */
  traceId?: string;
};

export const ATTACHMENT_DELETE_JOB_NAME = "delete";
export const ATTACHMENT_DELETE_JOB_ID_PREFIX = "attachment-delete";

export const attachmentDeleteJobId = (attachmentId: string): string =>
  jobIdFor(ATTACHMENT_DELETE_JOB_ID_PREFIX, attachmentId);

export type AttachmentDeleteQueue = TypedQueue<AttachmentDeleteJob>;

/**
 * A job that failed every attempt is dropped at once (`removeOnFail`): the DELETED row is the
 * record, and the sweeper's re-enqueue with the same id must not collide with a kept failed job.
 */
export const createAttachmentDeleteQueue = (connection: RedisConnection): AttachmentDeleteQueue =>
  createQueue<AttachmentDeleteJob>(QUEUE_NAMES.attachmentDelete, connection, {
    defaultJobOptions: { removeOnFail: true },
  });

export type EnqueueAttachmentDeleteOptions = {
  /** The request that dropped the file (`ctx.requestId`). */
  traceId?: string;
  /** The job waits until then (`objectDeletableAt`: the upload URL must have expired). */
  notBefore?: Date;
};

/** Producers call this AFTER the transaction that marked the row DELETED committed. */
export const enqueueAttachmentDeleteJob = (
  queue: AttachmentDeleteQueue,
  attachmentId: string,
  { traceId, notBefore }: EnqueueAttachmentDeleteOptions = {},
) =>
  queue.add(ATTACHMENT_DELETE_JOB_NAME, traceId ? { attachmentId, traceId } : { attachmentId }, {
    jobId: attachmentDeleteJobId(attachmentId),
    delay: notBefore ? Math.max(0, notBefore.getTime() - Date.now()) : 0,
  });

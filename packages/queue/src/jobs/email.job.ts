import type { RedisConnection } from "../connection";
import { jobIdFor } from "../job-id";
import { QUEUE_NAMES } from "../names";
import { createQueue } from "../queue";
import type { TypedQueue } from "../queue";

/**
 * Email job contract shared by the producer (apps/api email.service) and the consumer
 * (apps/worker email.processor). The payload carries the outbox row id only.
 */
export type EmailJob = {
  outboxEmailId: string;
  traceId?: string;
};

export const EMAIL_JOB_NAME = "send";
export const EMAIL_JOB_ID_PREFIX = "email";

/** Template names + payload shapes rendered by the worker (apps/worker/src/mail/templates.ts). */
export const EMAIL_TEMPLATES = {
  verification: "verification-email",
} as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];

export type EmailTemplatePayloads = {
  "verification-email": { name: string; url: string };
};

export const emailJobId = (outboxEmailId: string): string =>
  jobIdFor(EMAIL_JOB_ID_PREFIX, outboxEmailId);

export type EmailQueue = TypedQueue<EmailJob>;

export const createEmailQueue = (connection: RedisConnection): EmailQueue =>
  createQueue<EmailJob>(QUEUE_NAMES.email, connection);

/** Producers call this AFTER the outbox row's transaction committed. */
export const enqueueEmailJob = (queue: EmailQueue, outboxEmailId: string, traceId?: string) =>
  queue.add(EMAIL_JOB_NAME, traceId ? { outboxEmailId, traceId } : { outboxEmailId }, {
    jobId: emailJobId(outboxEmailId),
  });

import { createOutboxEmailRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, UnrecoverableError, createWorker } from "@repo/queue";
import type { EmailJob, Job, RedisConnection, TypedWorker } from "@repo/queue";

import { PermanentMailError } from "../mail/mail-provider";
import type { MailProvider } from "../mail/mail-provider";
import { TemplateError, renderEmail } from "../mail/templates";

export type EmailProcessorDeps = {
  connection: RedisConnection;
  db: PrismaClient;
  provider: MailProvider;
  logger: Logger;
  /** Override for tests (isolated queues); production uses QUEUE_NAMES.email. */
  queueName?: string;
};

export const EMAIL_WORKER_CONCURRENCY = 5;
export const EMAIL_WORKER_LIMITER = { max: 20, duration: 1000 };

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const isLastAttempt = (job: Job<EmailJob>): boolean =>
  job.attemptsStarted >= (job.opts.attempts ?? 1);

/**
 * Sends one outbox email. Idempotent: re-reads the row and does nothing when it is already
 * SENT (or FAILED — manual retries go through the row, see docs/adr/0004-outbox.md).
 */
export const processEmailJob = async (
  deps: Pick<EmailProcessorDeps, "db" | "provider" | "logger">,
  job: Job<EmailJob>,
): Promise<void> => {
  const outbox = createOutboxEmailRepository(deps.db);
  const log = deps.logger.child({
    jobId: job.id,
    outboxEmailId: job.data.outboxEmailId,
    traceId: job.data.traceId ?? null,
  });

  const row = await outbox.findById(job.data.outboxEmailId);
  if (!row) {
    // The producer enqueues after commit, so a missing row means it was deleted on purpose.
    log.warn("outbox row not found; dropping job");
    throw new UnrecoverableError(`OutboxEmail ${job.data.outboxEmailId} not found`);
  }
  if (row.status !== "PENDING") {
    log.info({ status: row.status }, "outbox row already final; nothing to do");
    return;
  }

  let rendered;
  try {
    rendered = renderEmail(row.template, row.payload);
  } catch (error) {
    const reason = describeError(error);
    await outbox.markFailed(row.id, reason);
    log.error({ err: error }, "email template failed; row marked FAILED");
    throw new UnrecoverableError(reason);
  }

  try {
    const result = await deps.provider.send({ to: row.to, ...rendered });
    await outbox.markSent(row.id);
    log.info({ messageId: result.messageId ?? null }, "email sent");
  } catch (error) {
    const reason = describeError(error);
    const permanent = error instanceof PermanentMailError || error instanceof TemplateError;
    if (permanent || isLastAttempt(job)) {
      await outbox.markFailed(row.id, reason);
      log.error({ err: error, permanent }, "email delivery failed permanently; row marked FAILED");
      throw permanent ? new UnrecoverableError(reason) : error;
    }
    await outbox.recordFailedAttempt(row.id, reason);
    log.warn({ err: error, attempt: job.attemptsStarted }, "email delivery failed; will retry");
    throw error;
  }
};

export const createEmailWorker = (deps: EmailProcessorDeps): TypedWorker<EmailJob> =>
  createWorker<EmailJob>(
    deps.queueName ?? QUEUE_NAMES.email,
    (job) => processEmailJob(deps, job),
    deps.connection,
    {
      concurrency: EMAIL_WORKER_CONCURRENCY,
      limiter: EMAIL_WORKER_LIMITER,
      logger: deps.logger,
    },
  );

import { createOutboxEmailRepository, withTransaction } from "@repo/database";
import type { OutboxEmail, PrismaClient, TransactionContext } from "@repo/database";
import type { Logger } from "@repo/logger";
import { enqueueEmailJob } from "@repo/queue";
import type { EmailQueue, EmailTemplate, EmailTemplatePayloads } from "@repo/queue";

/**
 * Outbox producer (docs/adr/0004-outbox.md): the row is written inside the transaction, the
 * job is enqueued only after the commit. The worker renders `template` with `payload`.
 */

export type EmailDeps = {
  db: PrismaClient;
  emailQueue: EmailQueue;
  logger: Logger;
};

export type EmailRequest<T extends EmailTemplate = EmailTemplate> = {
  to: string;
  template: T;
  payload: EmailTemplatePayloads[T];
  /** Correlates the job with the originating request (ctx.requestId). */
  traceId?: string;
};

/**
 * Use inside an existing `withTransaction` callback: the row joins the caller's transaction
 * and the enqueue is registered as an after-commit hook.
 */
export const queueEmailInTransaction = async <T extends EmailTemplate>(
  deps: Pick<EmailDeps, "emailQueue">,
  { tx, afterCommit }: TransactionContext,
  request: EmailRequest<T>,
): Promise<OutboxEmail> => {
  const row = await createOutboxEmailRepository(tx).create({
    to: request.to,
    template: request.template,
    payload: request.payload,
  });
  afterCommit(() => enqueueEmailJob(deps.emailQueue, row.id, request.traceId));
  return row;
};

/** Standalone send: opens its own transaction. Used by Better Auth's mail hook. */
export const sendEmail = <T extends EmailTemplate>(
  deps: EmailDeps,
  request: EmailRequest<T>,
): Promise<OutboxEmail> =>
  withTransaction(deps.db, (transaction) => queueEmailInTransaction(deps, transaction, request), {
    // The row is committed; if the enqueue fails the sweeper re-enqueues it.
    onAfterCommitError: (error) => {
      deps.logger.error(
        { err: error, traceId: request.traceId },
        "email enqueue after commit failed",
      );
    },
  });

import type { OutboxEmail, Prisma } from "../generated/prisma/client";
import type { DbClient } from "../utils/transaction";

export type CreateOutboxEmailData = {
  to: string;
  template: string;
  payload: Prisma.InputJsonValue;
};

/**
 * The outbox row is the durable truth for every email (PENDING → SENT | FAILED).
 * See docs/adr/0004-outbox.md. Status transitions are the worker's job; this file only persists.
 */
export const createOutboxEmailRepository = (db: DbClient) => ({
  create: (data: CreateOutboxEmailData): Promise<OutboxEmail> => db.outboxEmail.create({ data }),

  findById: (id: string): Promise<OutboxEmail | null> =>
    db.outboxEmail.findUnique({ where: { id } }),

  markSent: (id: string): Promise<OutboxEmail> =>
    db.outboxEmail.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    }),

  /** A retryable failure: keeps PENDING so the queue retry / sweeper can try again. */
  recordFailedAttempt: (id: string, lastError: string): Promise<OutboxEmail> =>
    db.outboxEmail.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError },
    }),

  /** Terminal failure: only a manual retry (resetToPending) brings it back. */
  markFailed: (id: string, lastError: string): Promise<OutboxEmail> =>
    db.outboxEmail.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError },
    }),

  resetToPending: (id: string): Promise<OutboxEmail> =>
    db.outboxEmail.update({ where: { id }, data: { status: "PENDING", lastError: null } }),

  /** Rows the sweeper re-enqueues: still PENDING after the grace period, oldest first. */
  findStalePending: (olderThan: Date, limit = 100): Promise<OutboxEmail[]> =>
    db.outboxEmail.findMany({
      where: { status: "PENDING", createdAt: { lt: olderThan } },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),
});

export type OutboxEmailRepository = ReturnType<typeof createOutboxEmailRepository>;

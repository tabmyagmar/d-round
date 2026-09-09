import type { Prisma, PrismaClient } from "../generated/prisma/client";

export type TransactionClient = Prisma.TransactionClient;

/** Anything a repository can run queries against: the client or an open transaction. */
export type DbClient = PrismaClient | TransactionClient;

export type AfterCommitHook = () => void | Promise<void>;

export type TransactionContext = {
  tx: TransactionClient;
  /**
   * Register work that must run only after the transaction has committed — queue
   * producers, notifications, cache invalidation. Never enqueue inside the transaction.
   */
  afterCommit: (hook: AfterCommitHook) => void;
};

export type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /**
   * Called for each after-commit hook that throws. The database work is already
   * committed at that point, so by default failures are collected and thrown as an
   * AfterCommitError once every hook has run.
   */
  onAfterCommitError?: (error: unknown) => void;
};

export class AfterCommitError extends Error {
  readonly errors: readonly unknown[];

  constructor(errors: readonly unknown[]) {
    super(`${String(errors.length)} after-commit hook(s) failed; the transaction was committed`);
    this.name = "AfterCommitError";
    this.errors = errors;
  }
}

/**
 * Interactive transaction with after-commit hooks. The callback receives the transaction
 * client; hooks registered via `afterCommit` run sequentially once the commit succeeded
 * and never run on rollback.
 */
export const withTransaction = async <T>(
  prisma: PrismaClient,
  callback: (context: TransactionContext) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> => {
  const { onAfterCommitError, ...prismaOptions } = options;
  const hooks: AfterCommitHook[] = [];

  const result = await prisma.$transaction(
    (tx) =>
      callback({
        tx,
        afterCommit: (hook) => {
          hooks.push(hook);
        },
      }),
    prismaOptions,
  );

  const failures: unknown[] = [];
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      if (onAfterCommitError) {
        onAfterCommitError(error);
      } else {
        failures.push(error);
      }
    }
  }

  if (failures.length > 0) {
    throw new AfterCommitError(failures);
  }

  return result;
};

import { createAuditLogRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { TIME_ZONE, dayjs } from "@repo/dayjs";
import type { Logger } from "@repo/logger";
import { QUEUE_NAMES, createQueue, createWorker } from "@repo/queue";
import type { RedisConnection, TypedQueue, TypedWorker } from "@repo/queue";
import { AUDIT_LOG_RETENTION_DAYS } from "@repo/validation";

/**
 * The audit log's retention (docs/adr/0015-audit-log.md). Once a day at 04:00 in Japan it deletes
 * the rows created before the start of the day `AUDIT_LOG_RETENTION_DAYS` ago — always older than
 * the migration's trigger asks — `AUDIT_LOG_SWEEP_BATCH` at a time, then records one SYSTEM row
 * with how many went. A second run the same day finds nothing and records nothing.
 */

export type AuditLogSweepJob = Record<string, never>;

export const AUDIT_LOG_SWEEP_PATTERN = "0 4 * * *";
export const AUDIT_LOG_SWEEP_BATCH = 1000;
export const AUDIT_LOG_SWEEP_SCHEDULER_ID = "audit-log-sweeper";

export type AuditLogSweepDeps = {
  db: PrismaClient;
  logger: Logger;
  now?: () => Date;
  /** Rows deleted per statement; tests make it small. */
  batch?: number;
};

export type AuditLogSweepResult = { deleted: number; cutoff: Date };

/** The rows created before this moment have been kept long enough: midnight in Japan, 90 days ago. */
export const auditLogCutoff = (now: Date): Date =>
  dayjs(now).tz(TIME_ZONE).subtract(AUDIT_LOG_RETENTION_DAYS, "day").startOf("day").toDate();

/** One sweep. Returns how many rows it deleted and the cut-off it used. */
export const sweepAuditLogs = async (deps: AuditLogSweepDeps): Promise<AuditLogSweepResult> => {
  const cutoff = auditLogCutoff(deps.now?.() ?? new Date());
  const batch = deps.batch ?? AUDIT_LOG_SWEEP_BATCH;
  const auditLogs = createAuditLogRepository(deps.db);

  let deleted = 0;
  for (;;) {
    const count = await auditLogs.deleteOlderThan(cutoff, batch);
    deleted += count;
    if (count < batch) {
      break;
    }
  }

  if (deleted > 0) {
    await auditLogs.create({
      actorType: "SYSTEM",
      action: "system.auditLogPurge",
      entityType: "AuditLog",
      entityLabel: `${dayjs(cutoff).tz(TIME_ZONE).format("YYYY/MM/DD")}より前`,
      status: "SUCCESS",
      changes: [{ field: "deletedCount", before: null, after: String(deleted) }],
    });
    deps.logger.info({ deleted, cutoff }, "audit log sweeper ran");
  }
  return { deleted, cutoff };
};

export const createAuditLogSweeperQueue = (
  connection: RedisConnection,
): TypedQueue<AuditLogSweepJob> =>
  createQueue<AuditLogSweepJob>(QUEUE_NAMES.auditLogSweeper, connection);

/** Registers (idempotently) the daily sweep — a BullMQ 6 job scheduler on Japan's clock. */
export const registerAuditLogSweeper = (queue: TypedQueue<AuditLogSweepJob>) =>
  queue.upsertJobScheduler(
    AUDIT_LOG_SWEEP_SCHEDULER_ID,
    { pattern: AUDIT_LOG_SWEEP_PATTERN, tz: TIME_ZONE },
    { name: "sweep" },
  );

export const createAuditLogSweeperWorker = (
  deps: AuditLogSweepDeps & { connection: RedisConnection; queueName?: string },
): TypedWorker<AuditLogSweepJob, AuditLogSweepResult> =>
  createWorker<AuditLogSweepJob, AuditLogSweepResult>(
    deps.queueName ?? QUEUE_NAMES.auditLogSweeper,
    () => sweepAuditLogs(deps),
    deps.connection,
    { concurrency: 1, logger: deps.logger },
  );

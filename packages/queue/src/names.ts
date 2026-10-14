/**
 * Registry of every queue in the system. Adding a queue means: add its name here, its
 * payload type in src/jobs/<name>.job.ts (ID-only payloads!), a processor in apps/worker.
 * See .claude/rules/queue.md.
 */
export const QUEUE_NAMES = {
  email: "email",
  /** Repeatable job that re-enqueues stale PENDING outbox emails (apps/worker). */
  outboxSweeper: "outbox-sweeper",
  /** Deletes the object of a DELETED attachment, then its row (ADR 0012). */
  attachmentDelete: "attachment-delete",
  /** Repeatable job that expires stale PENDING attachments and re-enqueues lost deletes. */
  attachmentSweeper: "attachment-sweeper",
  /** Checks and imports uploaded CSV files: jobs `check` and `import` (ADR 0013). */
  csvImport: "csv-import",
  /** Repeatable job that re-enqueues lost CSV jobs and fails interrupted ones (apps/worker). */
  csvImportSweeper: "csv-import-sweeper",
  /** Daily job that deletes the audit log's rows past the retention (ADR 0015). */
  auditLogSweeper: "audit-log-sweeper",
} as const satisfies Record<string, string>;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

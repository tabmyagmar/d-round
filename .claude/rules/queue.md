---
paths:
  - "packages/queue/**"
  - "apps/worker/**"
---

# Queue rules (BullMQ 6 + ioredis 6)

The database row is the source of truth; the queue is only a trigger. Every rule below follows from
that. The email outbox is the reference implementation (`docs/adr/0004-outbox.md`):

| Part           | File                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Queue names    | `packages/queue/src/names.ts` — `QUEUE_NAMES.email`, `QUEUE_NAMES.outboxSweeper`                                            |
| Job contract   | `packages/queue/src/jobs/email.job.ts` — `EmailJob`, `EMAIL_TEMPLATES`, `emailJobId`, `enqueueEmailJob`, `createEmailQueue` |
| Row            | `OutboxEmail` (`packages/database/src/repositories/outbox-email.repository.ts`)                                             |
| Producer       | `apps/api/src/modules/email/email.service.ts` — `queueEmailInTransaction`, `sendEmail`                                      |
| Consumer       | `apps/worker/src/processors/email.processor.ts` — `processEmailJob`, `createEmailWorker`                                    |
| Sweeper        | `apps/worker/src/schedulers/outbox-sweeper.ts` — `sweepOutboxEmails`, `registerOutboxSweeper`                               |
| Mail transport | `apps/worker/src/mail/*.ts` — `MailProvider`, SMTP (Mailpit in dev), memory (tests), `renderEmail`, `renderLayout`          |

## The seven rules

1. **ID-only payloads.** A job carries the IDs the worker needs to re-read state, plus an optional
   `traceId`, never the data itself: `EmailJob = { outboxEmailId: string; traceId?: string }`. Data
   in Redis goes stale; data in Postgres does not. The row carries `template` (a key of
   `EMAIL_TEMPLATES`) and `payload` (typed by `EmailTemplatePayloads`); the worker renders them.
2. **Enqueue AFTER commit.** Producers live in API services and register the enqueue with
   `afterCommit` inside `withTransaction` (`packages/database/src/utils/transaction.ts`):

   ```ts
   // apps/api/src/modules/email/email.service.ts
   export const queueEmailInTransaction = async (deps, { tx, afterCommit }, request) => {
     const row = await createOutboxEmailRepository(tx).create({
       to: request.to,
       template: request.template,
       payload: request.payload,
     });
     afterCommit(() => enqueueEmailJob(deps.emailQueue, row.id, request.traceId));
     return row;
   };
   ```

   `queueEmailInTransaction` joins the caller's transaction; `sendEmail(deps, request)` opens its
   own (Better Auth's `sendVerificationEmail` hook uses it, with `onAfterCommitError` logging the
   failure — the row is committed, the sweeper re-enqueues it). A job enqueued inside the
   transaction can run before the row exists — or after a rollback.

3. **Consumers only in `apps/worker`.** `createWorker` from `@repo/queue` is lint-forbidden
   everywhere else ("Queue consumers (createWorker) may only be created in apps/worker"). One
   processor file per queue: `apps/worker/src/processors/<queue>.processor.ts` exporting
   `create<Queue>Worker(deps)`, registered in the `workers` array of `apps/worker/src/index.ts`
   (today: the email processor, the outbox sweeper, the attachment delete processor, the attachment
   sweeper, the CSV import processor, the CSV import sweeper and the audit log sweeper).
4. **Deterministic jobId.** `jobIdFor(prefix, id)` (`packages/queue/src/job-id.ts`) returns
   `<prefix>-<id>`; both parts must match `[A-Za-z0-9_-]+` (BullMQ uses `:` as its key separator, so
   it is excluded) or `InvalidJobIdError` is thrown. Adding a job whose id already exists is a no-op
   in BullMQ, so the id must derive from the DB row — `emailJobId(outboxEmailId)` =
   `jobIdFor("email", outboxEmailId)` — never from a counter or `Date.now()`.
5. **Idempotent workers.** `processEmailJob` re-reads the row, returns without doing anything when
   `status !== "PENDING"`, renders (`renderEmail`), sends through `MailProvider.send`, then
   `markSent`. Jobs are retried and re-enqueued by the sweeper; the processor must survive running
   twice (tested: two enqueues of the same row → one mail, `attempts === 1`).
6. **Every queue name is registered** in `QUEUE_NAMES` (`packages/queue/src/names.ts`) and the queue
   is created with `createQueue<TPayload>(name, connection)` — for email through
   `createEmailQueue(connection)`. Ad-hoc queue strings do not exist.
7. **Logs carry `traceId`.** `createWorker(..., { logger })` logs `job failed` / `job completed`
   with `queue`, `jobId` and the payload's `traceId`; processors log through a child logger with
   `jobId`, `outboxEmailId`, `traceId`. Producers pass `ctx.requestId` as `traceId`.

## Default job options (`packages/queue/src/queue.ts`)

`DEFAULT_JOB_OPTIONS` is applied by `createQueue`; override per queue only with a stated reason.

| Option             | Value                                  | Effect                                |
| ------------------ | -------------------------------------- | ------------------------------------- |
| `attempts`         | `5`                                    | 5 tries in total                      |
| `backoff`          | `{ type: "exponential", delay: 3000 }` | 3s, 6s, 12s, 24s, 48s between tries   |
| `removeOnComplete` | `{ age: 86400, count: 1000 }`          | completed jobs kept 24h, at most 1000 |
| `removeOnFail`     | `{ age: 604800 }`                      | failed jobs kept 7 days, then deleted |

## FAILED semantics — why the row needs its own state

A failed job stays in Redis for 7 days and is then removed. Its deterministic jobId is then free
again, and nothing in Redis can tell "never enqueued" from "failed and cleaned up". Therefore:

- The durable failure record is the DB row: `OutboxEmail.status PENDING | SENT | FAILED`,
  `attempts`, `lastError`, `sentAt`. The repository has one method per transition: `markSent`,
  `recordFailedAttempt` (stays `PENDING`, increments `attempts`, stores `lastError`), `markFailed`
  (terminal), `resetToPending` (manual retry), `findStalePending` (sweeper).
- `processEmailJob` decides per failure:
  - transient error (SMTP down) and attempts left → `recordFailedAttempt`, rethrow → BullMQ retries
    with backoff;
  - last attempt (`job.attemptsStarted >= job.opts.attempts`) → `markFailed`, rethrow;
  - `PermanentMailError` (provider says it will never work) or `TemplateError` (unknown template,
    invalid payload) → `markFailed`, throw `UnrecoverableError` so BullMQ stops retrying;
  - row missing → `UnrecoverableError` (the producer enqueues after commit, so a missing row was
    deleted on purpose).
- The sweeper never touches `FAILED` rows, so a permanently failing job is not retried forever.
- Manual retry is an explicit operation on the row: `resetToPending(id)` (`FAILED` → `PENDING`,
  clears `lastError`); the sweeper — or an explicit `enqueueEmailJob` — picks it up. While the
  failed job still exists in Redis under the same jobId, a re-add is a no-op until that job is
  removed or retried — which is exactly why the retry goes through the row and not through Redis.
  The same pattern applies to every later outbox.
- The dashboard at `API_URL/queues` (bull-board, `docs/adr/0014-queue-dashboard.md`; who may open
  it: `.claude/rules/permissions.md`) is read-only for the same reason: it shows the queues, the
  rows stay the place to act.

## Sweeper

A job can be lost between commit and `queue.add` (process crash, Redis flush, failed after-commit
hook), so every outbox has a repeatable sweeper that re-enqueues rows still `PENDING` after a grace
period using the same deterministic ids, so duplicates collapse.
`apps/worker/src/schedulers/outbox-sweeper.ts`:

- `sweepOutboxEmails(deps)` — `findStalePending(now - OUTBOX_SWEEP_GRACE_MS, OUTBOX_SWEEP_BATCH)`
  and `enqueueEmailJob` for each row; grace 1 minute, batch 200, returns the count.
- `registerOutboxSweeper(queue)` — `queue.upsertJobScheduler(OUTBOX_SWEEP_SCHEDULER_ID, ...)` with
  scheduler id `outbox-email-sweeper`, `{ every: 120_000 }` and job name `sweep`, on the
  `QUEUE_NAMES.outboxSweeper` queue; idempotent, called once at worker start-up.
- `createOutboxSweeperWorker(deps)` — concurrency 1, registered next to the email worker.

BullMQ 6 repeatable jobs are **Job Schedulers**; the legacy `repeat` job option no longer exists.

## Attachment deletes — the second outbox

The same shape for files (`docs/adr/0012-attachments.md`): the `attachments` row is the truth, the
object in the bucket follows it.

| Part         | File                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue names  | `QUEUE_NAMES.attachmentDelete`, `QUEUE_NAMES.attachmentSweeper`                                                                                                  |
| Job contract | `packages/queue/src/jobs/attachment-delete.job.ts` — `AttachmentDeleteJob`, `attachmentDeleteJobId`, `enqueueAttachmentDeleteJob`, `createAttachmentDeleteQueue` |
| Row          | `Attachment` (`packages/database/src/repositories/attachment.repository.ts`)                                                                                     |
| Producer     | `apps/api/src/modules/attachment/attachment.service.ts` — `syncAttachments` marks dropped files `DELETED` and enqueues their deletes after commit                |
| Consumer     | `apps/worker/src/processors/attachment-delete.processor.ts` — `processAttachmentDeleteJob`, `createAttachmentDeleteWorker`                                       |
| Sweeper      | `apps/worker/src/schedulers/attachment-sweeper.ts` — `sweepAttachments`, `registerAttachmentSweeper`                                                             |
| Storage      | `@repo/storage` — `StorageProvider`, GCS, memory (tests)                                                                                                         |

- The processor acts on a `DELETED` row only: the object first (a missing object counts as deleted),
  then the row; a missing row is done. A storage error throws and BullMQ retries; a
  `PermanentStorageError` (the bucket answered 400 / 401 / 403) fails the job at once
  (`UnrecoverableError`).
- The queue drops a job that failed every attempt (`removeOnFail: true`): the `DELETED` row is the
  record, and the sweeper must be able to add the same job id again. What a permanent refusal means
  for the bucket and the alerts: `docs/attachments.md`.
- Producers pass `ctx.requestId` as `traceId` and `notBefore: objectDeletableAt(row.createdAt)`
  (`@repo/validation`): a delete waits until the file's upload URL has expired, so a replayed URL
  cannot recreate the object without a row. An enqueue that fails after commit is logged, not thrown
  — the sweeper picks the row up.
- `sweepAttachments` (scheduler id `attachment-sweeper`) expires stale `PENDING` rows and
  re-enqueues stale `DELETED` ones; a row it expires is enqueued by a later sweep, so a row attached
  in the same instant never meets a job. Its timings: `docs/attachments.md`.

## CSV imports — rules in the API, consumer in the worker

A CSV import (`docs/adr/0013-csv-import.md`) writes users, staff, clients and branches with the
forms' rules, which live in API services, so its two jobs run code of the API: the worker imports
the runners from `@repo/api/jobs` (`.claude/rules/layers.md`) and keeps the consumer.

| Part         | File                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue names  | `QUEUE_NAMES.csvImport`, `QUEUE_NAMES.csvImportSweeper`                                                                                      |
| Job contract | `packages/queue/src/jobs/csv-import.job.ts` — `CsvImportJob`, `csvCheckJobId`, `csvImportJobId`, `enqueueCsvCheckJob`, `enqueueCsvImportJob` |
| Rows         | `CsvImport`, `CsvImportRow` (`packages/database/src/repositories/csv-import.repository.ts`)                                                  |
| Runners      | `apps/api/src/modules/csv-import/csv-import.runner.ts` — `runCsvCheck`, `runCsvImport` (exported by `apps/api/src/jobs`)                     |
| Consumer     | `apps/worker/src/processors/csv-import.processor.ts` — `processCsvImportJob`, `createCsvImportWorker`                                        |
| Sweeper      | `apps/worker/src/schedulers/csv-import-sweeper.ts` — `sweepCsvImports`, `registerCsvImportSweeper`                                           |

- One queue, two job names: `check` (`csv-check-<id>`, default 5 attempts) and `import`
  (`csv-import-<id>`, `attempts: 1`, as a retry would write rows again). Failed jobs are dropped at
  once (`removeOnFail: true`): the import row is the record, and the sweeper re-adds the same ids.
- A runner re-reads the import and claims it with one conditional update; a second run of the same
  job changes nothing. The check's claim also accepts `CHECKING`, so a retry of the same job runs
  again (it only reads and replaces the rows); the processor tells the runner whether the attempt is
  the last (`job.attemptsStarted >= job.opts.attempts`), and only the last one marks the import
  `FAILED`. The import writes each row through the entity's service and records its result.
- The runner acts for the uploader through `buildJobContext` (`apps/api/src/core/context.ts`): their
  current grants, no request headers; a deactivated uploader fails the import.
- `sweepCsvImports` (scheduler id `csv-import-sweeper`, every 2 minutes) re-enqueues `UPLOADED` and
  `CONFIRMED` imports older than a minute, and fails `CHECKING` and `IMPORTING` imports whose
  `updated_at` (bumped by every claim and every row) is older than 10 minutes — an interrupted
  import is never run again.

## Audit log retention — a sweeper without a job of its own

The audit log (`docs/adr/0015-audit-log.md`) is written synchronously in the writes' transactions;
the queue only runs its retention. `apps/worker/src/schedulers/audit-log-sweeper.ts`:
`sweepAuditLogs` deletes the rows created before midnight in Japan `AUDIT_LOG_RETENTION_DAYS` (90,
`@repo/validation`) ago, `AUDIT_LOG_SWEEP_BATCH` (1,000) at a time, and records one `SYSTEM` row
`system.auditLogPurge` with the count; `registerAuditLogSweeper` upserts the scheduler
`audit-log-sweeper` with `{ pattern: "0 4 * * *", tz: "Asia/Tokyo" }` on
`QUEUE_NAMES.auditLogSweeper`. The cut-off is always older than the migration's trigger requires, so
the trigger never refuses its deletes; a run that finds nothing records nothing.

## BullMQ 6 / ioredis 6 notes

- `ioredis` is a peer dependency of BullMQ; we always pass an ioredis instance
  (`createRedisConnection(url, { connectionName })` from `packages/queue/src/connection.ts`), never
  a plain options object. `REDIS_CONNECTION_DEFAULTS` sets `maxRetriesPerRequest: null` (blocking
  commands must be allowed to wait indefinitely) and `enableReadyCheck: true`. ioredis 6 speaks
  RESP3 by default.
- One connection per role: producers share one, every `Worker` gets its own (BullMQ duplicates it
  for blocking commands), pub/sub uses dedicated publisher and subscriber connections
  (`createPubSub`). Call `waitForRedis(connection)` before starting workers.
- Permanent failures throw `UnrecoverableError` (re-exported from `@repo/queue`) so BullMQ stops
  retrying; the processor marks the row `FAILED` first.
- `createWorker` defaults to `concurrency: 1`; raise it (and add a `limiter`) per queue with a
  reason. Email: `EMAIL_WORKER_CONCURRENCY = 5`,
  `EMAIL_WORKER_LIMITER = { max: 20, duration: 1000 }`.
- Payload types are declared in `packages/queue/src/jobs/<name>.job.ts` and imported by both the
  producer and the processor: the worker and the API share only `@repo/queue` and `@repo/database`,
  never each other's code.
- The worker knows nothing about "sending mail" beyond the `MailProvider` interface
  (`apps/worker/src/mail/mail-provider.ts`). `createSmtpMailProvider` (nodemailer, `MAIL_SMTP_URL`,
  `MAIL_FROM`) is production/dev; `createMemoryMailProvider` is the mail double (the attachment
  worker's is `createMemoryStorage`, `.claude/rules/testing.md`).

## Tests

Queue code is tested against real Redis and Postgres: `apps/worker/test/support.ts` provides
`createWorkerHarness`, `isolatedEmailQueue` (unique queue name per test, short backoff),
`createPendingEmail`, `waitForFinalStatus`, `waitForJobDone`. Use a unique queue name per test and
call `worker.close()` and `queue.obliterate({ force: true })` in `finally`. Required tests for a new
job: enqueue only after commit (rollback → no row, no job — `email.service.test.ts`), duplicate
jobId is a no-op, processor idempotency, transient retry records attempts, last attempt and
permanent errors mark `FAILED`, sweeper recovers a `PENDING` row after Redis was flushed
(`outbox-sweeper.test.ts`).

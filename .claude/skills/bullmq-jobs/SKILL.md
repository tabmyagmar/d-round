---
name: bullmq-jobs
description:
  Use when adding a new background job, queue, processor or repeatable sweeper, or when debugging
  job retries and failures.
---

# BullMQ jobs

## Purpose

Background work follows the outbox pattern: a DB row is the truth, the job is a trigger with IDs
only, the worker is idempotent. Rules: `.claude/rules/queue.md`; decision:
`docs/adr/0004-outbox.md`. The email job is the reference — copy it.

## The email job end to end

1. **Name** — `packages/queue/src/names.ts`: `QUEUE_NAMES.email = "email"` and
   `QUEUE_NAMES.outboxSweeper = "outbox-sweeper"`.
2. **Row** — `OutboxEmail` (`to`, `template`, `payload Json`, `status PENDING | SENT | FAILED`,
   `attempts`, `sentAt`, `lastError`) with the repository
   `packages/database/src/repositories/outbox-email.repository.ts`: `create`, `findById`,
   `markSent`, `recordFailedAttempt`, `markFailed`, `resetToPending`, `findStalePending`.
3. **Job contract** — `packages/queue/src/jobs/email.job.ts`, shared by producer and consumer:

   ```ts
   export type EmailJob = { outboxEmailId: string; traceId?: string };
   export const EMAIL_TEMPLATES = {
     verification: "verification-email",
   } as const;
   export type EmailTemplatePayloads = {
     "verification-email": { name: string; url: string };
   };
   export const emailJobId = (outboxEmailId: string) => jobIdFor("email", outboxEmailId);
   export const createEmailQueue = (connection: RedisConnection): EmailQueue =>
     createQueue<EmailJob>(QUEUE_NAMES.email, connection);
   export const enqueueEmailJob = (queue: EmailQueue, outboxEmailId: string, traceId?: string) =>
     queue.add("send", traceId ? { outboxEmailId, traceId } : { outboxEmailId }, {
       jobId: emailJobId(outboxEmailId),
     });
   ```

4. **Queue instance** — `createEmailQueue(redis)` in the API composition root
   (`apps/api/src/index.ts`) and in the worker (`apps/worker/src/index.ts`, for the sweeper).
5. **Producer** — `apps/api/src/modules/email/email.service.ts`:

   ```ts
   export const queueEmailInTransaction = async (deps, { tx, afterCommit }, request) => {
     const row = await createOutboxEmailRepository(tx).create({
       to: request.to,
       template: request.template,
       payload: request.payload,
     });
     afterCommit(() => enqueueEmailJob(deps.emailQueue, row.id, request.traceId));
     return row;
   };

   export const sendEmail = (deps, request) =>
     withTransaction(
       deps.db,
       (transaction) => queueEmailInTransaction(deps, transaction, request),
       {
         onAfterCommitError: (error) => deps.logger.error({ err: error }, "email enqueue failed"),
       },
     );
   ```

   Inside an existing transaction use `queueEmailInTransaction`; standalone (Better Auth's
   `sendVerificationEmail` hook) use `sendEmail`. `request.payload` is typed by the template.

6. **Processor** — `apps/worker/src/processors/email.processor.ts`, `processEmailJob(deps, job)`:
   - `findById` → missing row: `UnrecoverableError`; `status !== "PENDING"`: return (idempotent);
   - `renderEmail(row.template, row.payload)` → `TemplateError`: `markFailed` +
     `UnrecoverableError`;
   - `provider.send({ to, subject, text, html })` → ok: `markSent`;
   - send failed: `PermanentMailError` or last attempt (`job.attemptsStarted >= job.opts.attempts`)
     → `markFailed` (+ `UnrecoverableError` when permanent); otherwise `recordFailedAttempt` and
     rethrow so BullMQ retries.
   - `createEmailWorker(deps)` =
     `createWorker<EmailJob>(QUEUE_NAMES.email, processor, connection, options)` with
     `concurrency: 5`, `limiter: { max: 20, duration: 1000 }` and `logger`; `deps.queueName`
     overrides the name for isolated test queues.
7. **Register** — the `workers` array in `apps/worker/src/index.ts` holds `createEmailWorker` and
   `createOutboxSweeperWorker`; start-up runs `waitForRedis` then `registerOutboxSweeper`.
8. **Sweeper** — `apps/worker/src/schedulers/outbox-sweeper.ts`:

   ```ts
   export const registerOutboxSweeper = (queue, everyMs = OUTBOX_SWEEP_INTERVAL_MS) =>
     queue.upsertJobScheduler("outbox-email-sweeper", { every: everyMs }, { name: "sweep" });

   export const sweepOutboxEmails = async (deps) => {
     const olderThan = new Date(Date.now() - OUTBOX_SWEEP_GRACE_MS); // 1 minute
     const stale = await createOutboxEmailRepository(deps.db).findStalePending(olderThan, 200);
     for (const row of stale) {
       await enqueueEmailJob(deps.emailQueue, row.id); // same jobId → duplicates collapse
     }
     return stale.length;
   };
   ```

   Every 2 minutes; `FAILED` rows are never touched.

9. **Tests** — `apps/api/test/modules/email/email.service.test.ts` (row + job after commit, nothing
   after rollback), `apps/worker/test/processors/email.processor.test.ts` (exactly once with a
   duplicate enqueue, no-op on `SENT`, transient retries record attempts, `FAILED` after the last
   attempt, permanent failures fail on the first attempt),
   `apps/worker/test/schedulers/outbox-sweeper.test.ts` (recovers a `PENDING` row after `FLUSHALL`,
   repeated runs do not duplicate). Helpers: `apps/worker/test/support.ts`.

## Adding a new job

Repeat the nine steps with a new name: `QUEUE_NAMES.<name>`, `packages/queue/src/jobs/<name>.job.ts`
(payload type, `<name>JobId`, `create<Name>Queue`, `enqueue<Name>Job`), an outbox model if the work
must not be lost, a producer in the owning service (`afterCommit`), a processor in
`apps/worker/src/processors/<name>.processor.ts`, registration in `apps/worker/src/index.ts`, a
sweeper when there is an outbox, and the tests above.

## Retry and failure semantics

- `DEFAULT_JOB_OPTIONS`: 5 attempts, exponential backoff from 3 s; completed jobs removed after 24 h
  (at most 1000 kept); failed jobs removed after 7 days.
- Because the failed job disappears while its deterministic jobId stays the same, the row's `FAILED`
  status is the durable record. The sweeper skips `FAILED` rows; manual retry is
  `resetToPending(id)` on the row, then the sweeper (or an explicit `enqueueEmailJob`) picks it up.
- Permanent failures (`PermanentMailError` from the provider, `TemplateError` from `renderEmail`):
  mark the row `FAILED` and throw `UnrecoverableError` so BullMQ does not retry.
- The memory provider (`createMemoryMailProvider({ failFirst, alwaysFailPermanently })`) is how
  tests provoke each path.

## Gotchas (BullMQ 6 / ioredis 6)

- Pass an ioredis instance (`createRedisConnection`) — ioredis is a peer dependency now.
- The `repeat` job option is gone; use Job Schedulers (`upsertJobScheduler`).
- `maxRetriesPerRequest: null` is mandatory for workers (set in `REDIS_CONNECTION_DEFAULTS`).
- jobId characters: `[A-Za-z0-9_-]` only; `jobIdFor` throws on anything else (no `:`).
- Use `job.attemptsStarted` (not `attemptsMade`) to detect the last attempt inside the processor:
  `attemptsMade` is incremented only after the attempt fails.
- Do not share the worker's connection with pub/sub; `createPubSub` uses its own connections.
- Worker logs must include `traceId` from the payload — `createWorker`'s `logger` option does it for
  completed and failed events; use a child logger inside the processor.
- `createWorker` outside `apps/worker` is a lint error.

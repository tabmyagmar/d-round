---
name: bullmq-jobs
description: Use when adding a new background job, queue, processor or repeatable sweeper, or when debugging job retries and failures.
---

# BullMQ jobs

## Purpose

Background work follows the outbox pattern: a DB row is the truth, the job is a trigger with IDs
only, the worker is idempotent. Rules: `.claude/rules/queue.md`.

## How-to: add a new job end to end

1. **Name** — add the queue to `QUEUE_NAMES` in `packages/queue/src/names.ts`
   (`email: "email"`). Ad-hoc strings are not allowed.
2. **Row** — if the job represents work that must not be lost, add an outbox model with
   `status PENDING | SENT | FAILED`, `attempts`, `lastError`, `sentAt` (see the `prisma` skill).
3. **Payload type** — next to the producer, IDs only:
   `type EmailJob = { outboxEmailId: string; traceId?: string }`.
4. **Queue instance** — `createQueue<EmailJob>(QUEUE_NAMES.email, connection)` in the API
   composition root; it applies `DEFAULT_JOB_OPTIONS`.
5. **Producer** — in the service, inside `withTransaction`:

   ```ts
   await withTransaction(ctx.db, async ({ tx, afterCommit }) => {
     const row = await createOutboxEmailRepository(tx).create(data);
     afterCommit(() =>
       emailQueue.add(
         "send",
         { outboxEmailId: row.id, traceId: ctx.requestId },
         { jobId: jobIdFor("email", row.id) },
       ),
     );
   });
   ```

6. **Processor** — `apps/worker/src/processors/email.processor.ts` exporting
   `createEmailWorker(deps)` built with
   `createWorker<EmailJob>(QUEUE_NAMES.email, processor, connection, { logger, concurrency })`:
   load the row → return if `SENT` → do the work → mark `SENT`; on the last attempt or an
   `UnrecoverableError`, mark `FAILED` with `lastError`.
7. **Register** — push the worker into the `workers` array in `apps/worker/src/index.ts`.
8. **Sweeper?** — yes whenever step 2 applies:
   `queue.upsertJobScheduler("email-sweeper", { every: 120_000 }, { name: "sweep" })`, with a
   processor that re-enqueues `PENDING` rows older than 1 minute using the same `jobIdFor`.
9. **Tests** — rollback → no row and no job; duplicate jobId → one job; processor run twice → one
   side effect; sweeper recovers a `PENDING` row after Redis is flushed.

<!-- Phase 1: add real example (email outbox: OutboxEmail, email.processor.ts, sweeper) -->

## Retry and failure semantics

- `DEFAULT_JOB_OPTIONS`: 5 attempts, exponential backoff from 3 s; completed jobs removed after
  24 h (at most 1000 kept); failed jobs removed after 7 days.
- Because the failed job disappears while its deterministic jobId stays the same, the row's
  `FAILED` status is the durable record. The sweeper skips `FAILED` rows; manual retry sets the
  row back to `PENDING`.
- Permanent failures (invalid address, 4xx from the provider): mark the row `FAILED` and throw
  `UnrecoverableError` so BullMQ does not retry.

## Gotchas (BullMQ 6 / ioredis 6)

- Pass an ioredis instance (`createRedisConnection`) — ioredis is a peer dependency now.
- The `repeat` job option is gone; use Job Schedulers (`upsertJobScheduler`).
- `maxRetriesPerRequest: null` is mandatory for workers (set in `REDIS_CONNECTION_DEFAULTS`).
- jobId characters: `[A-Za-z0-9_-]` only; `jobIdFor` throws on anything else (no `:`).
- Do not share the worker's connection with pub/sub; `createPubSub` uses its own connections.
- Worker logs must include `traceId` from the payload — `createWorker`'s `logger` option does it
  for completed and failed events; use a child logger inside the processor.
- `createWorker` outside `apps/worker` is a lint error.

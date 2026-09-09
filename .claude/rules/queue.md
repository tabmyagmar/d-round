---
paths:
  - "packages/queue/**"
  - "apps/worker/**"
---

# Queue rules (BullMQ 6 + ioredis 6)

The database row is the source of truth; the queue is only a trigger. Every rule below follows
from that.

## The seven rules

1. **ID-only payloads.** A job carries the IDs the worker needs to re-read state, plus an optional
   `traceId`, never the data itself: `{ outboxEmailId: string; traceId?: string }`. Data in Redis
   goes stale; data in Postgres does not.
2. **Enqueue AFTER commit.** Producers live in API services and register the `queue.add(...)`
   call with `afterCommit` inside `withTransaction` (`packages/database/src/utils/transaction.ts`).
   A job enqueued inside the transaction can run before the row exists — or after a rollback.
3. **Consumers only in `apps/worker`.** `createWorker` from `@repo/queue` is lint-forbidden
   everywhere else ("Queue consumers (createWorker) may only be created in apps/worker"). One
   processor file per queue: `apps/worker/src/processors/<queue>.processor.ts` exporting
   `create<Queue>Worker(deps)`, registered in the `workers` array of `apps/worker/src/index.ts`.
4. **Deterministic jobId.** `jobIdFor(prefix, id)` (`packages/queue/src/job-id.ts`) returns
   `<prefix>-<id>`; both parts must match `[A-Za-z0-9_-]+` (BullMQ uses `:` as its key separator,
   so it is excluded) or `InvalidJobIdError` is thrown. Adding a job whose id already exists is a
   no-op in BullMQ, so the id must derive from the DB row (`jobIdFor("email", outboxEmail.id)`),
   never from a counter or `Date.now()`.
5. **Idempotent workers.** The processor re-reads the row, returns without doing anything when the
   work is already done (`status === "SENT"`), performs the side effect, then marks the row. Jobs
   are retried and re-enqueued by the sweeper; the processor must survive running twice.
6. **Every queue name is registered** in `QUEUE_NAMES` (`packages/queue/src/names.ts`) and the
   queue is created with `createQueue<TPayload>(name, connection)`. Ad-hoc queue strings do not
   exist. Phase 0 ships no concrete queue on purpose.
7. **Logs carry `traceId`.** `createWorker(..., { logger })` logs `job failed` / `job completed`
   with `queue`, `jobId` and the payload's `traceId`; processors log through a child logger with
   the same bindings. Producers pass `ctx.requestId` as `traceId`.

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

- The durable failure record is the DB row. An outbox row has `status PENDING | SENT | FAILED`,
  `attempts`, `lastError`, `sentAt`. When the processor exhausts its attempts (compare
  `job.attemptsMade` with `job.opts.attempts`) or throws `UnrecoverableError`, it marks the row
  `FAILED` with `lastError`.
- The sweeper never touches `FAILED` rows, so a permanently failing job is not retried forever.
- Manual retry is an explicit operation on the row (`FAILED` → `PENDING`); the sweeper, or an
  explicit re-enqueue, picks it up. While the failed job still exists in Redis under the same
  jobId, a re-add is a no-op until that job is removed or retried — which is exactly why the retry
  goes through the row and not through Redis. Phase 1 implements this for `OutboxEmail`; the same
  pattern applies to every later outbox.

## Sweeper

A job can be lost between commit and `queue.add` (process crash, Redis flush, failed after-commit
hook), so every outbox has a repeatable sweeper that re-enqueues rows still `PENDING` after a grace
period (Phase 1: every 2 minutes, rows older than 1 minute, `status != FAILED`) using the same
`jobIdFor(...)`, so duplicates collapse. BullMQ 6 repeatable jobs are **Job Schedulers**:
`queue.upsertJobScheduler(schedulerId, { every: ms }, { name, data })`. The legacy `repeat` job
option no longer exists.

## BullMQ 6 / ioredis 6 notes

- `ioredis` is a peer dependency of BullMQ; we always pass an ioredis instance
  (`createRedisConnection(url, { connectionName })` from `packages/queue/src/connection.ts`),
  never a plain options object. `REDIS_CONNECTION_DEFAULTS` sets `maxRetriesPerRequest: null`
  (blocking commands must be allowed to wait indefinitely) and `enableReadyCheck: true`. ioredis 6
  speaks RESP3 by default.
- One connection per role: producers share one, every `Worker` gets its own (BullMQ duplicates it
  for blocking commands), pub/sub uses dedicated publisher and subscriber connections
  (`createPubSub`). Call `waitForRedis(connection)` before starting workers.
- Permanent failures throw `UnrecoverableError` (from `bullmq`) so BullMQ stops retrying; the
  processor marks the row `FAILED` first.
- `createWorker` defaults to `concurrency: 1`; raise it (and add a `limiter`) per queue with a
  reason (Phase 1 email: concurrency 5, limiter 20/s).
- Payload types are declared next to the producer and imported by the processor: the worker and
  the API share only `@repo/queue` and `@repo/database`, never each other's code.

## Tests

Queue code is tested against real Redis: `@repo/queue/test` exports `startTestRedis()` (image
`redis:8-alpine`, override with `TEST_REDIS_IMAGE`) and the package's `test/global-setup.ts`
provides `inject("redisUrl")`. Use a unique queue name per test and call `worker.close()` and
`queue.obliterate({ force: true })` in `finally`. Required tests for a new job: enqueue only after
commit (rollback → no job), duplicate jobId is a no-op, processor idempotency, sweeper recovers a
`PENDING` row after Redis was flushed.

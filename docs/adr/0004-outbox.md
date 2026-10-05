# ADR 0004 — Transactional outbox for email (first real queue job)

Date: 2026-09-09 · Status: accepted

## Context

Email must not be lost when the API crashes between "user saved" and "job enqueued", must not be
sent twice on retries, and must survive a Redis flush. BullMQ keeps failed jobs only for a while, so
Redis cannot be the durable record.

## Decision

- **Table `outbox_emails`** (`OutboxEmail`: `to`, `template`, `payload Json`,
  `status PENDING | SENT | FAILED`, `attempts`, `sentAt`, `lastError`) is the source of truth.
  Migration `0001_init`.
- **Producer** (API `email.service`): insert the row inside the caller's transaction, enqueue
  `{ outboxEmailId, traceId }` with `jobIdFor("email", row.id)` **after commit** (`withTransaction`
  → `afterCommit`).
- **Consumer** (`apps/worker` `email.processor`): re-read the row, no-op when `SENT`, send through
  the `MailProvider` interface (SMTP → Mailpit in dev), mark `SENT`; on the last attempt or an
  `UnrecoverableError` mark `FAILED` with `lastError`. Concurrency 5, limiter 20/s.
- **Sweeper**: BullMQ 6 job scheduler every 2 minutes re-enqueues rows still `PENDING` after 1
  minute (never `FAILED`), with the same deterministic ids so duplicates collapse.
- **Manual retry** = set the row back to `PENDING`; the sweeper picks it up.

## Alternatives

Send inline from the request (lost on failure, slow requests); enqueue inside the transaction (job
may run before commit or after rollback); rely on BullMQ failed set (expires, not queryable by
business code).

## Consequences

Every future side effect (notifications, PDF) follows the same shape: row first, job after commit,
idempotent worker, sweeper. Failure state lives in Postgres and is visible to the app.

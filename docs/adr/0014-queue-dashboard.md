# ADR 0014 — Read-only queue dashboard at /queues

Date: 2026-10-14 · Status: accepted

## Context

Nobody could see the BullMQ queues: whether a mail, an attachment delete or a CSV import waits, runs
or failed, and whether the three sweepers still fire, was only visible through `redis-cli`.
romuten-v3 mounts bull-board at `/queues` on its Express backend
(`apps/backend/src/lib/bullmq/board.ts`) behind HTTP Basic Auth with credentials from the env,
because its web app authenticates with a Bearer token the browser does not send on a navigation.

## Decision

- **bull-board on the API.** `createQueueBoard` (`apps/api/src/lib/queue-board.ts`) mounts
  `@bull-board/hono` with `@bull-board/api` and `@bull-board/ui` (9.10.4; BullMQ 5.56+ and 6) at
  `/queues`. Its queues come from the producers' factories (`createEmailQueue`, …; the sweepers'
  with the defaults, as in the worker), so the board shows the job options the jobs carry; the test
  fails when `QUEUE_NAMES` gains a queue the board lacks. They share the API's Redis connection and
  log its errors at `debug` (the connection's own listener logs them at `error`). `tsdown` keeps the
  packages external, so the UI files load from `node_modules` at runtime; `@bull-board/api` loads
  `bullmq` itself, an optional peer that resolves through `@repo/queue`'s hoisted copy.
- **Gate: super_admin only, in every environment.** The API sets the session cookie itself
  (`/api/auth`), so the browser sends it to `API_URL/queues`; the gate builds the request context
  (`buildRequestContext`) and lets `user.role === "super_admin"` through. No session or another role
  gets the app's 404 on every path below `/queues`, assets and API included. A role check, not a
  CASL rule: an operator tool, not a business subject (`.claude/rules/permissions.md`).
- **Read-only.** Every queue is `readOnlyMode: true` (bull-board hides the actions and answers 405),
  and the gate answers 405 (`Allow: GET, HEAD`) to any other method itself, so a future bull-board
  route cannot write either. The DB row is the truth (ADR 0004): a retried `FAILED` job no-ops in
  its processor, and an obliterate would drop the sweepers' job schedulers until the worker
  restarts. Manual retry stays `resetToPending` on the row.

## Alternatives

- **Basic Auth as romuten-v3** — a shared password in the env and a second login, while the session
  already identifies the user.
- **A CASL subject (`read Queue`: a catalog row in `permissions.csv` and a migration)** —
  super_admin and admin hold the same grants today, so a catalog row could not tell them apart
  without a new role split; a `DENY` row cannot remove the role check, which is acceptable for one
  operator page.
- **bull-board's actions enabled** — retry, clean and obliterate act on Redis behind the outbox's
  back; read-only also leaves no write path to protect against CSRF.
- **A screen in apps/web** — a second implementation of what bull-board ships, for one role.
- **The board in apps/worker** — the worker has no HTTP server and no session handling.

## Consequences

- Three runtime dependencies in `apps/api` (with `ejs`, `valibot` and `redis-info` underneath).
- The page polls `/queues/api/*` while it is open; each poll is one access-log line.
- The page loads its fonts from Google Fonts (bull-board's template).
- Revisit when an operator needs to act from the board: a failed job that blocks the re-add of its
  jobId after `resetToPending` (`.claude/rules/queue.md`) is the likely first case.

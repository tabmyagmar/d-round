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
  `/queues`, one view per `QUEUE_NAMES` entry on the API's Redis connection, so a new queue shows up
  without a change here. `tsdown` keeps the packages external, so the UI files load from
  `node_modules` at runtime.
- **Gate: the Better Auth session, super_admin only, in every environment.** The API sets the
  session cookie itself (`/api/auth`), so the browser sends it to `API_URL/queues`. No session or
  another role gets the app's 404 on every path below `/queues`, assets and API included.
- **Read-only.** Every queue is `readOnlyMode: true` (bull-board hides the actions and answers 405),
  and the gate answers 405 to any non-GET request itself, so a future bull-board route cannot write
  either. The DB row is the truth (ADR 0004): a retried `FAILED` job no-ops in its processor, and an
  obliterate would drop the sweepers' job schedulers until the worker restarts. Manual retry stays
  `resetToPending` on the row.

## Alternatives

- **Basic Auth as romuten-v3** — a shared password in the env and a second login, while the session
  already identifies the user.
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

# Plan: Queue dashboard at /queues

Ticket: `feature/D_ROUND-TBD_queue-dashboard`, cut from `develop` (`aca8099`, the CSV import
merged). Status: **approved 2026-10-14** ("ok") with both open questions answered by the
recommendation: `super_admin` only, and 404 (not a login redirect) for everyone else. One MR, one
commit.

Read before this plan: romuten-v3 `apps/backend/src/lib/bullmq/board.ts` (bull-board on Express at
`/queues`, 14 queues), `apps/backend/src/lib/middlewares/queue-dashboard-auth.ts` (Basic Auth) and
`apps/backend/src/server.ts` (open locally, Basic Auth elsewhere, unmounted without credentials);
bull-board docs: `server-adapters/hono.md`, `recipes/read-only-mode.md`, `recipes/bundling.md`,
`recipes/csrf-protection.md`; `@bull-board/api` 9.10.4 `providers/queue.ts` (read-only mode answers
405 on the server). The legacy d-round-api has no queue dashboard.

## Goal and acceptance criteria

A super_admin opens `API_URL/queues` in the browser and sees every BullMQ queue (the three job
queues and the three sweepers) with their jobs, read-only.

1. `GET /queues` as super_admin → 200, the bull-board page; its assets and `/queues/api/*` load.
2. The board lists one queue per `QUEUE_NAMES` entry, each `readOnlyMode: true`.
3. No session, or any other role → 404 with the app's not-found body, on every path below `/queues`.
4. Any non-GET request below `/queues` → 405, even for super_admin.

Done when `yarn verify` is green and the page was opened in the browser as super_admin and as admin
(404).

## Design

| Choice  | romuten-v3                                | Here                                                               | Why                                                                                                                                                                                           |
| ------- | ----------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter | `@bull-board/express` 7                   | `@bull-board/hono` 9.10.4 + `serveStatic` from `@hono/node-server` | the API is Hono; 9.x supports BullMQ 6                                                                                                                                                        |
| Gate    | Basic Auth, env credentials, open locally | Better Auth session, `role === "super_admin"`, every environment   | the API sets the session cookie itself, so a browser navigation carries it; no shared password, no env                                                                                        |
| Actions | retry / clean / pause allowed             | `readOnlyMode: true` + non-GET → 405 in the gate                   | the DB row is the truth: a retried FAILED job no-ops in the processor, obliterate drops the sweeper schedulers; manual retry stays `resetToPending`; no write path also means no CSRF surface |
| Queues  | hand-written list of 14                   | one per `QUEUE_NAMES` on the API's Redis connection                | a new queue shows up without touching the board                                                                                                                                               |

Files (one commit):

1. `apps/api/package.json`, `yarn.lock` — `@bull-board/api`, `@bull-board/hono`, `@bull-board/ui`
   (9.10.4, exact; `ui` because `@bull-board/api` asks for it as a peer). Built output keeps them
   external (`tsdown` `neverBundle`), so the UI files load from `node_modules` at runtime.
2. `apps/api/src/lib/queue-board.ts` (new) — `createQueueBoard({ auth, redis })`: a Hono sub-app
   with the gate, then bull-board's plugin with base path `/queues`.
3. `apps/api/src/app.ts` — `app.route("/queues", createQueueBoard(deps))`.
4. `apps/api/test/lib/queue-board.test.ts` (new) — the four criteria over `app.request`.
5. `docs/adr/0014-queue-dashboard.md` (new) — the new runtime dependency and the gate.
6. `.claude/rules/queue.md` — one line under the retry semantics: the board is read-only, manual
   retry is still `resetToPending`.

The board's queues share the API's Redis connection (BullMQ does not quit a shared client), so the
shutdown's `redis.quit()` ends them; `index.ts` does not change.

## Log

- 2026-10-14 implementation (inline, one commit). Amendment: `README.md` gets a `Queues` row in the
  local URL table (a seventh file, documentation only). `yarn verify` 43/43 (api suite fresh: 40
  files, 264 tests). Browser (headless Chromium, worktree API on 4001 against the dev Redis): as
  super_admin `/queues` lists the six queues with their real counts and no action buttons, a job
  shows only `outboxEmailId`, `/queues/queue/email` survives a reload; as admin and without a
  session `/queues` is the app's JSON 404. The same check against the built `dist/index.mjs` passes,
  so the externalised UI files resolve from `node_modules`.

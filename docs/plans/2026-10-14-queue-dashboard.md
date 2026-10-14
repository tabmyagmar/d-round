# Plan: Queue dashboard at /queues

Ticket: `feature/D_ROUND-TBD_queue-dashboard`, cut from `develop` (`aca8099`, the CSV import
merged). Status: **approved 2026-10-14** ("ok") with both open questions answered by the
recommendation: `super_admin` only, and 404 (not a login redirect) for everyone else. One MR, one
commit planned; **closed 2026-10-14** with four (feature, review rounds 1 and 2, a flaky test) and
merged into develop at the user's request.

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
- 2026-10-14 review round 1 (reviewer subagent, REQUEST_CHANGES, 0 BLOCKER / 3 SHOULD / 4 NIT; no
  gate bypass found: trailing slash, encoded paths, HEAD, CSRF). Fixed in the second commit:
  - SHOULD the gate built its own session lookup → it calls `buildRequestContext` and reads
    `ctx.user.role`; `createQueueBoard` takes `ContextDeps`.
  - SHOULD the role check is not CASL → ADR 0014 lists the CASL catalog row as a rejected
    alternative; `.claude/rules/permissions.md` records the gate next to Better Auth's role map;
    `queue.md` points there for who may open it. The README row keeps "sign in as super_admin" as a
    usage hint.
  - SHOULD the board's queues printed every Redis error to the console (BullMQ's `emit` fallback,
    seen in the test: six `console.error` calls) and showed the generic job options for
    attachment-delete and csv-import → each queue logs at `debug`, and the queues come from the
    producers' factories. **Amendment** to the Design table's "Queues" row: an explicit list of six
    instead of a map over `QUEUE_NAMES`; the test that compares the board with `QUEUE_NAMES` makes a
    missing queue a failure.
  - NIT HEAD got 405 → GET and HEAD pass, the 405 carries `Allow: GET, HEAD`; NIT the ADR names the
    runtime `bullmq` load; NIT an admin write is tested (404). Declined: moving the test file's doc
    comment off `let h` — `test/app.test.ts` has the same shape.
- 2026-10-14 verifier on `a10ff21`: PASS, fresh (`--cache=local:,remote:`), 43/43, 1544 tests.
  Review round 2 (reviewer subagent): every round-1 finding resolved, 0 BLOCKER / 1 SHOULD / 0 NIT —
  the Redis-error test cleaned up only on success and quit the connection without `waitForRedis`.
  Fixed in the third commit: `waitForRedis`, the cleanup in `finally` (the repo's idiom,
  `test/modules/user/user.service.test.ts`). Follow-up outside this MR (reviewer): the API's own
  producer queues in `index.ts` have no `error` listener either, so BullMQ prints a Redis error once
  per queue to the console.
- 2026-10-14 security review (general-purpose subagent; the `/security-review` skill needs
  `origin/HEAD`, unset here, and its base would not be the local develop): no HIGH or MEDIUM finding
  in `aca8099..a10ff21` — 21 paths × 7 methods probed in process against the real adapter tree, all
  gated; serveStatic rejects traversal; EJS and the UI escape job data; ID-only payloads. Outside
  the diff (for the user): an `admin` may call Better Auth's `POST /api/auth/admin/set-role` on
  itself and become `super_admin` (`packages/auth/src/access-control.ts` gives admin
  `user:set-role`).
- 2026-10-14 verify of the round-2 fix failed once: `user.service.test.ts` "offers every active user
  but the super_admins …" missed its users. `chargerOptions` returns the first `CHARGER_OPTIONS_MAX`
  (200) users in kana order; the test's users have no kana and random ids, and the files share one
  database, so when the file runs late (23rd that time) more than 200 users sort before them — this
  MR's admin fixture adds one. **Amendment**: a test-only fix in its own commit gives those users
  the kana `アアア`, so they sort first; verify 43/43 again.
- 2026-10-14 close: verify 43/43 on every commit but `01ccca9`, whose one failure was the
  charger-options flake fixed in the next commit; verifier fresh PASS on `a10ff21`; two review
  rounds; security review clean; browser-checked as super_admin, admin and without a session. What
  slowed the ticket: the `/security-review` skill cannot run here (it diffs `origin/HEAD...`, unset,
  and the local develop is not pushed) — protocol Step 6 could say "run it as a subagent on the
  explicit range when the skill cannot diff"; and editing the worktree while the verifier ran made
  its first report mixed — the orchestrator waits for the verifier before the next edit.

# Plan: Discord alerts for backend errors

Ticket: `feature/D_ROUND-TBD_discord-alerts` (one MR, four commits, each green on its own, ≤15
files). Status: **approved 2026-10-08** with every decision and default as written. Read before this
plan — this repo: `packages/logger/src/index.ts`, `apps/api/src/trpc/init.ts`
(`domainErrorMapping`), `apps/api/src/app.ts` (`app.onError`),
`apps/api/src/middleware/request-logger.ts`, `apps/api/src/index.ts`, `apps/worker/src/index.ts`,
`packages/queue/src/worker.ts` (`job failed`), `apps/*/src/lib/graceful-shutdown.ts`,
`.claude/rules/testing.md` (mocks only for external HTTP providers); romuten-v3:
`packages/notification/src/discord/discord.service.ts`,
`packages/notification/src/alert-service.ts`, `apps/backend/src/lib/discord.ts`,
`apps/backend/src/graphql/plugins/alert-error.ts` and `test/graphql/plugins/alert-error.test.ts`,
`apps/backend/src/config/env.ts`; pino 10 (`pino.multistream`, `redact`, `stdSerializers.err`),
pino-pretty 13 programmatic API (`build()`), Discord webhook docs (embed limits, HTTP 429).

## Today — how a backend error is handled (the audit the ticket asked for)

Nothing reaches Discord or any other channel. Every failure ends as one pino line on stdout, and two
kinds of failure do not even get that line. Every `error` / `fatal` call site:

| Where                                               | Line                                                                                                                                        | `err`?   | Alerts after this plan       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------- |
| `apps/api/src/trpc/init.ts` `domainErrorMapping`    | `request failed` (error) for `INTERNAL_SERVER_ERROR`; domain errors and 4xx → `request rejected` (warn)                                     | yes      | yes / no                     |
| `apps/api/src/app.ts` `app.onError`                 | `unhandled error` — Hono middleware and the Better Auth handler (tRPC errors never reach it: `@hono/trpc-server` answers inside)            | yes      | yes                          |
| `apps/api/src/middleware/request-logger.ts`         | `request completed` at error when status ≥ 500 — the access log; for a tRPC 500 it duplicates the line above (same `requestId`)             | no       | yes, folded into the request |
| `apps/api/src/index.ts`, `apps/worker/src/index.ts` | `redis connection error` — once per reconnect attempt while Redis is down (a flood)                                                         | yes      | yes, grouped                 |
| `apps/api/src/modules/email/email.service.ts`       | `email enqueue after commit failed`                                                                                                         | yes      | yes                          |
| `packages/queue/src/worker.ts` `createWorker`       | `job failed` on every failed attempt; `worker error`                                                                                        | yes      | yes, grouped                 |
| `apps/worker/src/processors/email.processor.ts`     | `email template failed; row marked FAILED`, `email delivery failed permanently; row marked FAILED` (then `job failed` for the same job)     | yes      | yes, folded into the job     |
| `apps/worker/src/index.ts`                          | `worker failed to start` (fatal) → `shutdown("startup failure")`                                                                            | yes      | yes, delivered before exit   |
| `apps/*/src/lib/graceful-shutdown.ts`               | `shutdown step failed` (error); `shutdown timed out, forcing exit` (error today, no `err`)                                                  | yes / no | yes / yes (becomes fatal)    |
| process                                             | `uncaughtException`, `unhandledRejection` — **no handler**: Node 24 prints the stack to stderr and exits 1; no pino line, no shutdown steps | —        | yes (new fatal handlers)     |

## Goal and acceptance criteria

- With `DISCORD_ALERT_WEBHOOK_URL` set, every `error` and `fatal` log line of the API and the worker
  becomes one Discord message: title = the log message, colour by level, service / env / level, the
  identifiers the line carries (`requestId`, `userId`, `traceId`, `path`, `type`, `method`,
  `status`, `queue`, `jobId`, `attemptsMade`, `outboxEmailId`, `step`), `err.type: err.message` and
  the first 8 stack lines in a code block, pino's `[Redacted]` wherever a secret was.
- One message per incident and per problem: lines sharing a `requestId` or `jobId` within 10 s are
  one message; the same fingerprint (service, message, error type, path / queue / status) is sent at
  most once per 5 minutes and the next message says how many repeats were suppressed; at most 10
  messages a minute per process. A webhook failure (network, timeout, 429, 5xx) is dropped after one
  stderr line — never retried, never thrown into a request or a job.
- Variable unset → the logger is built exactly as today (development, tests, CI). A malformed value
  refuses to start the process with `EnvValidationError`, like every other variable.
- A fatal exit (startup failure, uncaught exception, unhandled rejection, shutdown timeout) still
  delivers its message: `flush()` is the last shutdown step.
- Domain errors (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`), 4xx and
  `warn` lines never alert — unchanged.
- No new dependency. `yarn verify` green per commit. Smoke check from `yarn dev` with the real
  webhook (Step 5): Redis stopped → one message per process, no second one within 5 minutes; worker
  started with Redis down → its fatal message arrives although the process exits.

## Decisions (each names its reference; the user may override any of them at approval)

1. **Alerts are a log sink, not a service call.** `packages/logger` gets
   `createDiscordAlertStream(options)`: a `Writable` that receives the pino lines at level ≥ `error`
   through `pino.multistream` and POSTs an embed to the webhook. Reference: pino's own model
   (destinations per level; `pino-sentry`, `pino-slack-webhook` are this shape) and the repo's rule
   that pino is configured in one place ("do not create pino instances outside this package",
   `packages/logger/src/index.ts`). romuten-v3 did the opposite: an explicit
   `AlertService.notifyIfNeeded(...)` called from one Apollo plugin, so only GraphQL errors alerted
   and its worker, queue, Redis and shutdown failures went to `console.error` and nowhere else. A
   sink covers every present and future `logger.error` / `logger.fatal` in both processes with
   nothing to remember at a new call site, and the line that is the alert is also the line in the
   log — the log stays the truth, Discord is the signal (the queue rule "DB row is truth" applied to
   alerting).
2. **What alerts: every `error` and `fatal` line, deduplicated twice.** The pino level is the alert
   taxonomy — domain errors are already `warn` in `domainErrorMapping`, unknown failures `error`,
   process death `fatal` — so romuten-v3's `WARN | ERROR | CRITICAL` plus `NEVER_ALERT_CODES` /
   `SYSTEM_ALERT_CODES` is not ported. Two lines are written for one failure today
   (`request failed` + the access line; a processor's `… row marked FAILED` + `job failed`), so the
   sink folds lines that share an incident key — `requestId` or `jobId` — within
   `ALERT_INCIDENT_WINDOW_MS = 10_000` into the first one. Then a fingerprint
   `name | msg | err.type | path | queue | status` (the parts the line has) is sent once per
   `ALERT_WINDOW_MS = 5 * 60_000`; later repeats increment a counter that the next message of that
   fingerprint reports (`suppressed: 37 repeats in the last 5 min`). Reference: Sentry's issue
   grouping and "one event per request", scaled down to a Map; the flood cases are real today
   (`redis connection error` per reconnect, `job failed` per attempt, a hot 500).
3. **Limits and failure of the channel itself.** `ALERT_MAX_PER_MINUTE = 10` per process (Discord
   allows a webhook roughly 30 messages a minute and answers 429 above it); `fetch` with
   `AbortSignal.timeout(5000)`; a non-2xx or a rejected `fetch` is counted and written as one plain
   line to stderr (`onSendError`, injectable) — not through the logger, which would be re-entrant,
   and never retried: the log line already exists, a lost alert must not become a second failure.
   romuten-v3 had no limit, no timeout, and `console.error('Discord notification error')` per
   failure.
4. **Embed format — ported from romuten-v3's `discord.service.ts` and trimmed.** Kept: emoji + title
   (`🟠 request failed`, `🔴 worker failed to start`, ≤ 256), colour by level (error `15158332`,
   fatal `16711680` — romuten's values), description = `**err.type:** err.message` and a ` ```txt `
   code block with the first `ALERT_STACK_LINES = 8` stack lines (fences inside escaped, ≤ 4096),
   one inline field per identifier from the `ALERT_CONTEXT_KEYS` allow-list in that order (each ≤
   1024, ≤ 25 fields), `timestamp` = the line's `time`, `allowed_mentions: { parse: [] }`. Dropped:
   the Client field (no mobile app), the user's email and name (`userId` is enough and is not PII),
   the Severity field (title and colour say it), the `Romuten Alert` footer, the `@everyone` on
   production CRITICAL (without grouping it pinged everyone per occurrence; a mention is one line
   later if wanted). Discord limits: title 256, description 4096, field value 1024, 25 fields, 6000
   characters per embed.
5. **Redaction happens once, in pino.** The stream sees the serialized line after `redact`
   (`REDACT_PATHS`, `[Redacted]`), so a password or cookie never reaches the embed; a test proves it
   end to end. romuten-v3's `maskSensitive` regexes and `redactSensitiveValues` are not ported — two
   redactions are two places to miss a key.
6. **No new dependency; pino-pretty in-process.** Node 24's global `fetch`, `pino.multistream`, and
   pino-pretty's `build()` as a stream replace today's `transport: { target: "pino-pretty" }` (same
   output in `yarn dev`). Alternative — the sink as a pino transport in a worker thread (pino's
   recommended shape for heavy destinations): rejected because the thread resolves a module path
   that differs between `tsx` (TS source) and the `tsdown` bundle, the last `fatal` line is lost
   when the process exits before the thread flushes, and `fetch` cannot be injected in tests.
   Alternative — Sentry / Grafana alerting on shipped logs: the right answer at scale, out of scope
   for this template (ADR 0010 says when to revisit).
7. **Environment.** `DISCORD_ALERT_WEBHOOK_URL: urlSchema.optional()` in `apiEnvShape` and
   `workerEnvShape` (same name as romuten-v3, which read `env.X ?? ''` and tested for the empty
   string — here the option is typed and validated at start-up). Added to `turbo.json` `globalEnv`
   (strict env mode: otherwise `yarn dev` hides it from the process), `.env.example` (empty value;
   comment: optional, unset = no alerts, the URL is a secret), README table and
   `docs/conventions.md`. **The URL is a bearer secret** (anyone holding it can post to the
   channel): it goes into the root `.env` by hand — agents are denied `.env` — never into the plan,
   a test or a commit; it was pasted into a chat, so regenerate it in Discord (channel →
   Integrations → Webhooks) if that log is ever shared.
8. **Flush on shutdown, and fatal handlers.** `createDiscordAlertStream` returns
   `Writable & { flush: (timeoutMs?: number) => Promise<void> }` (in-flight sends tracked in a
   `Set`; `flush` waits at most 3 s — inside the API's 10 s and the worker's 30 s deadlines) and
   both `index.ts` register `{ name: "alerts", run: () => alerts?.flush() }` as the **last**
   shutdown step so step failures are reported too. Both `index.ts` add
   `process.on("uncaughtException", …)` and `process.on("unhandledRejection", …)` →
   `logger.fatal({ err }, "uncaught exception" | "unhandled rejection")` → `shutdown(reason)` (the
   function `registerGracefulShutdown` already returns). `shutdown timed out, forcing exit` becomes
   `fatal` (the process is dying). Reference: Node docs ("uncaughtException: synchronous cleanup,
   then exit"); pino's guidance on final logs; today Node 24 exits with a bare stack on stderr and
   runs no shutdown step at all. romuten-v3 had neither flush nor handlers.
9. **Where it lives: `packages/logger`, no new package.** One file, `src/discord-alert-stream.ts`,
   exported from the package; `createLogger` takes `alerts?: DiscordAlertStream`. The worker and the
   API already depend on `@repo/logger`; a `packages/alerts` would exist for one file and one
   consumer type (the "no helper without a second consumer" rule). romuten-v3's
   `packages/notification` mixes mail, push and Discord — here mail is the worker's and alerts are
   the logger's.
10. **ADR 0010 — "Error alerts to Discord through the logger"** (skill `adr`: an external
    integration and a choice between architectural options later work depends on). It records
    decisions 1–8, the alternatives in 6 and when to replace the sink with a log pipeline.

## romuten-v3 → new

| romuten-v3                                                                                                                                                   | new                                                                                                                                                      | Why                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DiscordService` class (`packages/notification`), lazy singletons `getAlertDiscordService()` / `getCsDiscordService()` over `env.X ?? ''`                    | `createDiscordAlertStream({ webhookUrl, fetch?, now?, onSendError? })` in `packages/logger`, one per process, built in `index.ts` from the validated env | typed optional URL, no empty-string sentinel, injectable seams for tests |
| `AlertService.notifyIfNeeded` called from `createApolloErrorPlugin` only; worker / queue / Redis / shutdown failures → `console.error`                       | pino stream on every `logger.error` / `logger.fatal` of both processes                                                                                   | one path; nothing to remember at a new call site (decision 1)            |
| `ErrorSeverity` WARN / ERROR / CRITICAL, `extensions.severity`, `NEVER_ALERT_CODES`, `SYSTEM_ALERT_CODES`                                                    | pino levels; domain errors are `warn` already                                                                                                            | the taxonomy exists (decision 2)                                         |
| no grouping, no rate limit, no timeout; `console.error` per webhook failure                                                                                  | incident fold 10 s, fingerprint window 5 min with suppressed count, 10/min cap, 5 s timeout, one stderr line                                             | decisions 2–3                                                            |
| `@everyone` on every production CRITICAL; optional `mentionUserIds`                                                                                          | no mentions; `allowed_mentions: { parse: [] }`                                                                                                           | decision 4                                                               |
| `maskSensitive` regexes, `redactSensitiveValues`, `[REDACTED]`                                                                                               | pino `redact` before the stream; proven by a test                                                                                                        | decision 5                                                               |
| embed: emoji + label title, colour by severity, fields Severity / Code / Client / Operation / Path / User / Message / Stack / Context, 1000-char cap, footer | title, colour, `err` description with 8-line stack, identifier fields from an allow-list, timestamp; no footer, no Client / User / Severity              | decision 4; Discord limits                                               |
| `fetch` without timeout, `response.text()` into a thrown error                                                                                               | `AbortSignal.timeout(5000)`; non-2xx counted, not thrown                                                                                                 | a slow webhook must not pin a process at exit (decision 3)               |
| no flush, no process handlers                                                                                                                                | `flush()` as the last shutdown step; `uncaughtException` / `unhandledRejection` → fatal → shutdown                                                       | decision 8                                                               |
| tests fake `AlertService` with `vi.fn()` and assert calls                                                                                                    | tests inject `fetch`, assert the posted JSON body                                                                                                        | behaviour, not implementation (`.claude/rules/testing.md`)               |

## Schema changes

None.

## Files to touch (one table per commit)

### Commit 1 — `feat(logger): Discord alert stream for error and fatal lines` (5)

| File                                                | Change                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/logger/src/discord-alert-stream.ts`       | new: `createDiscordAlertStream(options): DiscordAlertStream`; parses each line, incident fold → fingerprint window → per-minute cap (decisions 2–3), builds the embed (decision 4), POSTs, tracks in-flight sends, `flush`. Exports `ALERT_INCIDENT_WINDOW_MS`, `ALERT_WINDOW_MS`, `ALERT_MAX_PER_MINUTE`, `ALERT_STACK_LINES`, `ALERT_CONTEXT_KEYS` |
| `packages/logger/src/index.ts`                      | `CreateLoggerOptions.alerts?: DiscordAlertStream`; destination = `pino.multistream([{ level, stream: main }, { level: "error", stream: alerts }])` when alerts are given, the single stream otherwise; `pretty` through pino-pretty's `build()` in-process; re-export the stream factory and types                                                   |
| `packages/logger/test/discord-alert-stream.test.ts` | new (list below)                                                                                                                                                                                                                                                                                                                                     |
| `packages/logger/test/index.test.ts`                | + `alerts`: an error line reaches both the destination and the webhook; `password` in the line arrives as `[Redacted]` in the embed; `warn` never reaches the webhook                                                                                                                                                                                |
| `docs/adr/0010-alerts.md`                           | new (decision 10)                                                                                                                                                                                                                                                                                                                                    |

### Commit 2 — `feat(api): error and fatal alerts to Discord` `[parallel: A]` (7)

| File                                    | Change                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/env.ts`                   | `DISCORD_ALERT_WEBHOOK_URL: urlSchema.optional()` with the doc comment "Discord webhook for error and fatal alerts; unset = no alerts (ADR 0010)"                                                            |
| `apps/api/src/index.ts`                 | `alerts` built when the URL is set and passed to `createLogger`; keep `shutdown` from `registerGracefulShutdown`; `uncaughtException` / `unhandledRejection` handlers (decision 8); `alerts` flush step last |
| `apps/api/src/lib/graceful-shutdown.ts` | `shutdown timed out, forcing exit` → `logger.fatal`; `Pick<Logger, "info" \| "error" \| "warn" \| "fatal">`                                                                                                  |
| `apps/api/test/env.test.ts`             | new: accepts a complete environment without the variable; rejects a value that is not a URL                                                                                                                  |
| `apps/api/test/trpc/router.test.ts`     | + with an alerting logger (fake `fetch`): `exploding` → exactly one POST whose embed names `exploding`, `req-1` and the error type and hides nothing it should show; `missing` (domain error) → no POST      |
| `turbo.json`                            | `globalEnv` + `DISCORD_ALERT_WEBHOOK_URL`                                                                                                                                                                    |
| `.env.example`                          | `# --- Alerts (optional) ---` block with `DISCORD_ALERT_WEBHOOK_URL=` and the comment of decision 7                                                                                                          |

### Commit 3 — `feat(worker): error and fatal alerts to Discord` `[parallel: A]` (6)

| File                                                  | Change                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/worker/src/env.ts`                              | same optional variable and comment                                                                                                                                                  |
| `apps/worker/src/index.ts`                            | same wiring as the API (alerts, fatal handlers, flush step last)                                                                                                                    |
| `apps/worker/src/lib/graceful-shutdown.ts`            | same fatal change                                                                                                                                                                   |
| `apps/worker/test/env.test.ts`                        | + optional variable accepted, non-URL rejected                                                                                                                                      |
| `apps/worker/test/lib/graceful-shutdown.test.ts`      | the fake logger gains `fatal`; the timeout case asserts the fatal line                                                                                                              |
| `apps/worker/test/processors/email.processor.test.ts` | + a job failing permanently under an alerting logger (fake `fetch`) → exactly one POST (the processor's line and `job failed` fold into the job) naming the queue and the outbox id |

### Commit 4 — `docs: Discord alerting` (2)

| File                  | Change                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`           | env table row `DISCORD_ALERT_WEBHOOK_URL` (api/worker, optional); the **Health** bullet gains "error and fatal alerts to Discord (`docs/adr/0010-alerts.md`)"      |
| `docs/conventions.md` | Logging: what alerts, the two dedupes and the cap, where the sink lives; Environment variables: the optional variable for api and worker; Errors: one pointer line |

## Tests to add or update

`packages/logger/test/discord-alert-stream.test.ts` (fake `fetch` records every request; `now`
injected; the logger writes to a silent destination):

- an `error` line with `err` → one POST; the body's embed has the title from `msg`, the error
  colour, description with `type: message` and at most 8 stack lines, fields `service`, `env`,
  `requestId`, `path`; `allowed_mentions.parse` is empty
- a `fatal` line without `err` → one POST with the fatal colour
- `warn` and `info` lines → no POST
- two lines sharing a `requestId` within 10 s → one POST; the same `jobId` → one POST
- the same fingerprint twice within 5 minutes → one POST; after the window the next POST carries
  `suppressed` with the count; a different `path` is a different fingerprint
- 11 distinct errors inside one minute → 10 POSTs; the 11th is sent after the minute
- `fetch` answers 429 / rejects / exceeds the timeout → no throw, exactly one `onSendError` call, no
  retry
- a very long stack and message are cut to Discord's limits (title 256, field 1024,
  description 4096)
- `flush()` resolves once in-flight sends settle and does not wait beyond its timeout
- `createLogger` without `alerts` keeps the existing tests green (no behaviour change)

`apps/api/test/trpc/router.test.ts`, `apps/api/test/env.test.ts`, `apps/worker/test/env.test.ts`,
`apps/worker/test/lib/graceful-shutdown.test.ts`,
`apps/worker/test/processors/email.processor.test.ts`: as listed in the commit tables. The process
handlers (`uncaughtException`, `unhandledRejection`) are not unit-tested (they need a child
process); Step 5 exercises the fatal path for real.

## Steps (in order; `[parallel: A]` = commits 2 and 3 side by side after commit 1)

### Step 1 — the stream and the logger option

- Files: commit 1. Test first: `discord-alert-stream.test.ts` (red: no module), the `index.test.ts`
  additions. Then the stream, the `createLogger` change, ADR 0010. Confirm against the installed
  pino 10.3.1 / pino-pretty 13.1.3 types that `pino.multistream` accepts level labels per entry and
  how pino-pretty's `build` is imported under this tsconfig (default vs named import — see Risks)
  before writing `index.ts`.
- Check: `yarn workspace @repo/logger test`, `yarn lint`, `yarn typecheck`.

### Step 2 — API `[parallel: A]`

- Files: commit 2. Test first: `env.test.ts` and the two router cases (red). Then `env.ts`,
  `index.ts`, `graceful-shutdown.ts`, `turbo.json`, `.env.example`.
- Check: `yarn workspace @repo/api test`, `yarn lint`, `yarn typecheck`.

### Step 3 — worker `[parallel: A]`

- Files: commit 3. Test first: the env case, the shutdown fake logger, the processor case (red).
  Then `env.ts`, `index.ts`, `graceful-shutdown.ts`.
- Check: `yarn workspace @repo/worker test`, `yarn lint`, `yarn typecheck`.

### Step 4 — docs

- Files: commit 4. Then `yarn verify`.

### Step 5 — smoke check with the real webhook (the user, or the orchestrator with the user's go)

- Put `DISCORD_ALERT_WEBHOOK_URL=…` into the root `.env` by hand. `yarn dev` (api + worker, compose
  project `d-round`, ports 5433 / 6380 — never the romuten containers).
- `docker compose stop redis` → within seconds one 🟠 `redis connection error` from `api` and one
  from `worker`; no second message while Redis stays down; `curl -i localhost:4000/health` → 503 and
  one 🟠 `request completed` (`path /health`, `status 503`). `docker compose start redis` → silence
  (no "recovered" message — out of scope).
- Stop the worker, `docker compose stop redis`, start the worker alone → it logs
  `worker failed to start` and exits, and the 🔴 message is in the channel (flush). Start Redis
  again.
- Then protocol Step 6: `/security-review`, MR description, plan to `docs/plans/`.

## Risks and open questions

- **Three mechanisms (incident fold, fingerprint window, cap).** The incident fold exists only
  because two lines are written per failed request / job today. Dropping it (decision 2) means two
  messages for every 500 and for every permanently failed job; changing the request logger or
  `createWorker` to log at `warn` instead would lose the alert for a 500 that no other line reports
  (Better Auth answering 500 itself, a processor throwing before it logs). The user may prefer
  either; the plan keeps the fold.
- **`/health` 503 alerts** come for free under decision 2 (the access line is the only line for a
  degraded probe) and are grouped per path and status. If unwanted, the request logger's 5xx line
  moves to `warn` — one line in `request-logger.ts`.
- **pino-pretty import shape.** `index.d.ts` is `export = PinoPretty` with a namespace; under this
  tsconfig a default import or `import { build } from "pino-pretty"` must type-check and resolve at
  runtime (Node's CJS named-export detection sees `module.exports.build`). Confirmed in Step 1
  first; fallback is `createRequire`.
- **Strict turbo env.** Forgetting `globalEnv` gives a process that silently never alerts under
  `yarn dev`; Step 5 catches it; `node dist/index.mjs` in production does not go through turbo.
- **`uncaughtException` and async work.** Node calls the state undefined after it; the handler only
  logs, flushes with a 3 s cap and exits — strictly more than today's bare stack on stderr.
- **Constants** (10 s, 5 min, 10/min, 8 stack lines, 5 s timeout, 3 s flush) are exported from one
  file; the user may want other values at approval.
- **The pasted webhook URL** is in a chat log now (decision 7): regenerate it if that log leaves the
  team; this plan, the tests and the commits never contain it.

## Out of scope

- Errors of `apps/web` (Next.js server and client), business notifications to Discord (romuten's CS
  webhook: contact, trial, help), mentions / `@here`, a "recovered" message, stack-based
  fingerprinting, alerts on `warn`, a dashboard or a log pipeline (ADR 0010 names the trigger to
  move there).

## Log

- 2026-10-08 — plan drafted inline (planner role done by the orchestrator, as for the settings
  ticket).
- 2026-10-08 — approved by the user ("ok heregjuul") with every decision as written and the open
  questions at their defaults: the incident fold stays, `/health` 503 alerts, the constants as
  listed.
- 2026-10-08, step 1: `DiscordAlertStream` is pino's `DestinationStream` (`write`) plus `flush`, not
  a Node `Writable`: `multistream` only calls `write`. `multistream` and `destination` are imported
  by name (pino's types put them on the namespace, not on the nested `pino`). Over the per-minute
  cap a line is dropped and counted, and the next delivered message reports the count (field
  `dropped`) instead of holding the line for the next minute: holding needs a timer and a bounded
  queue, and the count already points to the logs. A failed send adds to the same count. The stack
  block shows the first 8 `at` frames (the message is already in the description's first line).
  Field labels are the log keys (`name`, `env`, `requestId`, ...), so an alert's labels can be
  searched in the logs as they are. The fetch timeout has no test of its own: `AbortSignal.timeout`
  rejects `fetch` like a network failure (tested), and the flush test covers a webhook that never
  answers. Checked under `tsx`: pretty output in-process with colours, JSON to stdout with alerts
  on, and the plain logger unchanged.
- 2026-10-08, branch: another session switched the shared working tree to
  `feature/D_ROUND-TBD_client-branch` at 22:01 while step 1 was uncommitted, so commit `78401e9`
  landed on that branch. `feature/D_ROUND-TBD_discord-alerts` was moved to `78401e9` and the work
  continues in a worktree in the session scratchpad. Moving `client-branch` back to `b3a1f29`
  (`git reset --keep`) was denied by auto mode: the user decides; the other session was told.
- 2026-10-08, step 2: the `uncaughtException` / `unhandledRejection` handlers live in
  `registerGracefulShutdown` (both apps), beside the signal handlers, instead of `index.ts`: the
  function already owns "process event → ordered steps → exit", the existing fake process tests
  them, and a crash must exit 1 — `shutdown(reason, exitCode)` gained the code (a failed step still
  exits 1). The API gets `test/lib/graceful-shutdown.test.ts` for that (eight files in commit 2).
  `.env.example` carries the variable commented out, like `COOKIE_DOMAIN`: an empty value would fail
  the URL check at start-up. The router alert test passed before the API code changed: it pins the
  wiring from commit 1 (a domain error never alerts, an unknown one alerts once).
- 2026-10-08, step 3: the processor test names the job and the outbox row, not the queue: the
  processor's line comes first and carries `jobId`, `outboxEmailId` and `traceId`, and `job failed`
  (which names the queue) folds into it; the `email-` prefix of the job id names the queue. The
  worker's start-up failure now exits 1 (`shutdown("startup failure", 1)`); it exited 0 whenever
  every shutdown step succeeded. Like the router test, the processor alert test passed before the
  worker code changed: it pins the fold for a real failed job.
- 2026-10-08, step 4: the README folder map also names `createDiscordAlertStream` under `logger/`.
  `docs/conventions.md` points to ADR 0010 for the numbers (fold window, repeat window, cap) instead
  of repeating them, and says when a new identifier key belongs in `ALERT_CONTEXT_KEYS`.
- 2026-10-08, step 5 (smoke, real webhook, no Docker touched; the variables were passed on the
  command line from the worktree, which has no `.env`): the worker started with Redis on a closed
  port wrote 61 error / fatal lines in 30 s (48 `worker error`, 12 `redis connection error`,
  `worker failed to start`, `shutdown timed out, forcing exit`) and exited 1; the API, also without
  Redis and Postgres, wrote 10 `redis connection error` and one `request completed` (`/health` 503)
  and exited 1 after SIGTERM. Expected in the channel: six messages (worker: redis connection error,
  worker error for `email` and for `outbox-sweeper`, worker failed to start; API: redis connection
  error, request completed 503); no send failed (no `discord alert not sent` on stderr). Found, not
  changed (it predates this ticket): without Redis the worker's `workers` step and the API's `redis`
  step wait until the shutdown deadline (30 s / 10 s), so the `alerts` flush step is not reached;
  the alerts still arrive because their sends run during the wait, and only the `shutdown timed out`
  line itself is lost, as ADR 0010 says.
- 2026-10-08, review (reviewer agent: 1 BLOCKER, 4 SHOULD, 5 NIT; verifier agent PASS: fresh
  `yarn verify --force` 40/40, logger 17, api 11, worker 16 targeted tests). BLOCKER, fixed in its
  own commit (outside the plan's files: `apps/api/src/middleware/request-logger.ts`, its new test,
  `docs/auth.md`): the access line logged the raw path, and Better Auth's mailed link is
  `/api/auth/reset-password/<token>`, so a 5xx there would have posted a live one-hour token to
  Discord; the token was also in every info access line on stdout. The request logger now writes
  that segment as `[Redacted]`.
- 2026-10-08, review fixes, second commit. SHOULD, all taken: a fatal line skips the per-minute cap
  (ten errors and a fatal give eleven messages); `registerGracefulShutdown` keeps the highest exit
  code any caller asked for, so a crash during a running shutdown exits 1 (a test per app); pruning
  walks each map only up to its first live entry (a sent problem moves to the end of its map) and
  forgets a problem quiet for two windows together with its count, so memory holds at most the last
  ten minutes of problems. Personal data in error messages, which the reviewer left to the user: the
  stricter default is taken until the user says otherwise. Only the first line of a message is sent,
  e-mail addresses masked, and ADR 0010 says what can still reach the channel. NIT, all taken: the
  secrets test is named for what it proves (the allow-list; the plan's "`[Redacted]` in the embed"
  case cannot exist, since no allow-listed key is a redact path); a throwing `onSendError` is
  caught; `docs/conventions.md` says the two lines of a failed request fold into one alert; the
  webhook must be an https URL; the cap test counts after `flush()`.
- 2026-10-08, review round 2 (same reviewer agent, resumed): the ten round-1 findings fixed; one new
  SHOULD and two NITs, all taken. The e-mail mask was quadratic on a long run without `@` (measured:
  100 000 characters blocked the event loop 4 s; the new one-megabyte test took 438 s red); the line
  is now cut to `MESSAGE_MAX + 256` before the mask (an address has at most 254 characters), and the
  test runs in milliseconds. "Quiet for two windows" was wrong: a problem is forgotten two windows
  after its last message (ADR, code comment, test name). `docs/conventions.md` points to ADR 0010
  for the embed's contents instead of repeating them. No third review round: the protocol's budget
  of two is spent, and the fix is pinned by the red-then-green test.

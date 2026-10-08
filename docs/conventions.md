# Conventions — the why behind the rules

`CLAUDE.md` states the rules, the linter enforces most of them, and this document explains them for
humans. Rule of thumb: a rule that lives in a document drifts, a rule that lives in a tool does not.
Everything mechanical therefore lives in ESLint, Prettier, commitlint and CI, and this file only
says why.

## Layer contract

```text
                +-------------------------------------------------------------+
  apps/web      |  apps/api                                                   |
  (Next.js)     |                                                             |
     |  tRPC    |  transport   apps/api/src/trpc   (graphql/, rest/ later)     |
     +--------->|      |  zod input -> ability check -> service call           |
  types only    |      v                                                      |
  (AppRouter)   |  service     apps/api/src/modules/<name>/<name>.service.ts   |
                |      |  business rules, workflow checks, transactions        |
                |      |  domain errors (core/errors.ts) -> core/error-mapping |
                +------|------------------------------------------------------+
                       v
                repository   packages/database/src/repositories   <---- apps/worker
                       |     pure data access, Prisma types              (BullMQ consumers,
                       v                                                 idempotent)
                prisma       packages/database/src/client.ts                 ^
                       |                                                     | jobs: IDs only,
                       v                                                     | after commit
                   PostgreSQL                        Redis  <--- packages/queue
```

Allowed directions: transport → service → repository → prisma, each layer importing only itself, the
layer directly below and shared packages. Composition roots (`apps/api/src/index.ts`, `app.ts`,
`env.ts`, `middleware/`, `health/`, `lib/`) may import every layer because they wire them together.
`apps/worker` reuses repositories and packages, never `@repo/api`. `apps/web` imports `@repo/api`
types only.

Why:

- **Adding a transport must not touch business code.** GraphQL and REST arrive as sibling folders of
  `trpc/` that wrap the same `buildRequestContext` and the same services. That only works if
  services know nothing about HTTP, tRPC or Hono.
- **Errors stay meaningful.** Services throw `NotFoundError`, `ForbiddenError`, `ConflictError`,
  `ValidationError`; each transport maps them once (`core/error-mapping.ts`). A service throwing
  `TRPCError` would tie every future transport to tRPC.
- **Repositories stay boring.** Pure data access is reused by the API, the worker and scripts, and
  is tested against a real database without any business context.
- **The rule is checked, not remembered.** `boundaries/dependencies` in
  `packages/eslint-config/boundaries.js` classifies every file into an element type and rejects
  imports in the wrong direction; a misplaced import fails `yarn lint`, the pre-commit hook and CI.
  The full matrix is in `.claude/rules/layers.md`.

## Lint rule groups

All rule groups live in `packages/eslint-config/base.js` (ESLint 10 flat config, type-aware via
`projectService`). Presets: `base` (framework-less packages), `node` (apps/api, apps/worker, Node
packages), `react` (packages/ui), `next` (apps/web). Each group in `base.js` starts with a short WHY
comment; the long form is here.

### Functions

`func-style: expression` and `prefer-arrow-callback` (no named function expressions). One function
shape everywhere: arrow functions have no `this`, no hoisting surprises, and read the same in
modules, callbacks and React components. Class methods are unaffected.

### Modules and imports

- `import-x/no-default-export` — named exports keep symbols greppable and refactor-safe (rename
  once, every import follows). Exempt: config files (`*.config.*`, `eslint.config.*`,
  `prisma.config.ts`, `postcss.config.*`) and Next.js framework files (`page`, `layout`, `route`,
  `proxy.ts`, `middleware.ts`, `instrumentation*.ts`, ...) because the tool, not us, decides.
- `import-x/no-duplicates` (`prefer-inline`) and `import-x/consistent-type-specifier-style`
  (`prefer-inline`) — one import statement per module, with `type` markers inline.
- `import-x/no-cycle` (`maxDepth: 4`) — cycles produce `undefined` at load time and hide layering
  mistakes.
- `import-x/order` — deterministic blocks: Node built-ins, third-party, `@repo/*` workspace
  packages, `@/` aliases, then relative paths (parent, sibling, index); alphabetised, one blank line
  between groups. Reviewers never spend time on import order and diffs stay small.
- `eslint-plugin-import-x` replaces `eslint-plugin-import`, which has no ESLint 10 support.

### Types

- `@typescript-eslint/no-explicit-any` — `any` switches the type checker off for everything it
  touches. Use `unknown` and narrow.
- `consistent-type-imports` and `consistent-type-exports` (inline `type` specifiers) — with
  `verbatimModuleSyntax` the compiler and bundlers must be able to erase type-only imports; marking
  them also documents runtime vs. type dependencies (the boundaries rule allows type-only imports
  across some boundaries for exactly this reason).
- `consistent-type-definitions: type` — one way to declare shapes; `type` composes with unions and
  mapped types without special cases.
- `no-unused-vars` with the `_` prefix escape — dead code is a smell; a deliberately unused
  parameter is marked, not silenced.
- `switch-exhaustiveness-check` — adding an enum value must break the build wherever the value is
  not handled.
- `restrict-template-expressions` (numbers and booleans allowed) — objects in template strings print
  `[object Object]`.
- `no-misused-promises` with `checksVoidReturn.attributes/arguments: false` — React props and event
  handlers legitimately receive async functions.
- Base presets: `strictTypeChecked` + `stylisticTypeChecked`. The TypeScript preset
  (`packages/typescript-config/base.json`) sets `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`,
  `noImplicitReturns` and `noFallthroughCasesInSwitch`.

### Logging

`no-console: error`. Console output has no level, no structure and no redaction, and is lost in
production. Everything goes through `@repo/logger` (pino), which redacts `password`, `token`,
`secret`, `authorization`, `cookie` and `set-cookie` paths once for every app. `packages/logger`
itself and the worker bootstrap opt out locally where no logger can exist yet.

The level is also the alert: with `DISCORD_ALERT_WEBHOOK_URL` set, every `error` and `fatal` line of
the API and the worker is posted to a Discord channel (`createDiscordAlertStream`,
`docs/adr/0010-alerts.md`). Log what a user or a client caused (domain errors, 4xx) at `warn`, a
failure somebody must look at at `error`, a dying process at `fatal`. The lines of one request or
job become one message, a repeated problem is sent once per window with a repeat count, and the
messages per minute are capped; only the identifier keys of `ALERT_CONTEXT_KEYS`, the log message
and the error (type, first message line with e-mail addresses masked, first stack frames) reach
Discord, so a new identifier worth seeing is added there.

### Naming

- `unicorn/filename-case: kebabCase` — kebab-case files with a role suffix (`user.service.ts`,
  `user.repository.ts`, `user.router.ts`, `user.schema.ts`, `email.processor.ts`) make the layer
  visible in the file name and greppable (`*.service.ts`). Dynamic route segments (`[id]`) are
  ignored; the `react` preset additionally allows `PascalCase.tsx` for components (shadcn generates
  kebab-case, both are fine).
- `unicorn/prefer-node-protocol` — `node:fs` is unambiguous for bundlers (`tsdown`) and readers.

### Environment

`turbo/no-undeclared-env-vars` (allow list: `NEXT_PUBLIC_*`, `TEST_*`, `NODE_ENV`, `CI`). Turborepo
runs tasks in strict env mode: a variable that is not declared in `turbo.json` (`globalEnv`, a
task's `env`, or `globalPassThroughEnv`) is not passed to the task and silently disappears. The lint
rule turns that into a lint error instead of a production surprise. Apps read the environment
exactly once through `createEnv(shape)` from `@repo/validation/env` (zod, fails fast with a readable
list of problems).

### Layer boundaries

`boundaries/dependencies` from `eslint-plugin-boundaries` 7, configured in
`packages/eslint-config/boundaries.js`: element types (`api-transport`, `api-service`, `api-core`,
`api-app`, `repository`, `database`, `worker`, `web`, `ui`, `shared`), `default: "disallow"`,
policies evaluated in order with the last match winning, and `@repo/*` imports matched by package
name so the rules do not depend on how workspace symlinks resolve. See "Layer contract" above and
`.claude/rules/layers.md` for the full matrix.

### Misc footguns

`eqeqeq: always` (no coercion surprises), `curly: all` (no dangling single-statement branches in
diffs), `no-param-reassign` (arguments are inputs), `object-shorthand`, `prefer-template` (no string
concatenation). `eslint-config-prettier` is applied last so no stylistic rule can disagree with
Prettier.

### Overrides

- Tests (`**/*.test.{ts,tsx}`, `**/test/**/*.ts`): `no-non-null-assertion`, `no-unsafe-*`,
  `no-empty-function`, `require-await` and `unbound-method` are off — tests assert behaviour, and a
  little type looseness keeps them readable. Everything else, including `no-console` and the
  boundaries, applies.
- Plain JavaScript files (`*.js`, `*.mjs`, `*.cjs`): the same function, import-order, naming and
  footgun rules without type information.
- React (`packages/eslint-config/react.js`): `@eslint-react/eslint-plugin`
  `recommended-type-checked` (replaces the unmaintained `eslint-plugin-react`) and
  `eslint-plugin-react-hooks`. Next (`next.js`): `@next/eslint-plugin-next` `core-web-vitals` plus
  the framework default-export exemptions.

## File naming

| Thing                 | Pattern                              | Example                                  |
| --------------------- | ------------------------------------ | ---------------------------------------- |
| Service               | `<name>.service.ts`                  | `user.service.ts`                        |
| Repository            | `<name>.repository.ts`               | `user.repository.ts`                     |
| tRPC router           | `<name>.router.ts`                   | `user.router.ts`                         |
| zod schemas           | `<name>.schema.ts`                   | `user.schema.ts`                         |
| Worker processor      | `<queue>.processor.ts`               | `email.processor.ts`                     |
| Test                  | `test/<src path>.test.ts`            | `test/modules/user/user.service.test.ts` |
| React component       | `PascalCase.tsx` or `kebab-case.tsx` | `status-badge.tsx`, `button.tsx`         |
| Next.js special files | framework names                      | `page.tsx`, `layout.tsx`, `proxy.ts`     |
| Config                | `<tool>.config.{ts,mjs}`             | `vitest.config.ts`                       |
| ADR                   | `NNNN-<kebab-title>.md`              | `0001-stack.md`                          |

One exported unit per file where practical; named exports only (see above).

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `build:`),
optionally scoped (`feat(api): ...`). Enforced by commitlint (`commitlint.config.mjs`, extends
`@commitlint/config-conventional`): body lines at most 100 characters, footer lines at most 200
(trailers may be long), and a subject that does not start upper case (`subject-case`) — name a
component in words (`feat(web): address fields fill …`, not `AddressFields fill …`). Hooks via
husky: `pre-commit` runs `lint-staged` (`eslint --fix --max-warnings 0` and `prettier --write` on
staged files), `commit-msg` runs `commitlint`. CI re-checks every commit of a pull request with
`commitlint --from <base> --to <head>`.

Why: the history is the changelog and the audit trail; a machine-readable format makes releases,
blame and bisecting cheap, and a hook is the only place where a rule is applied every time.

## AI attribution

AI-assisted commits carry a `Co-Authored-By` trailer naming the model, so the history shows which
changes were produced with an agent:

```text
feat(user): add changeRole with last-admin guard

Body lines wrap at 100 characters.

Co-Authored-By: Claude <model name> <noreply@anthropic.com>
```

For example: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

Pull request descriptions produced with an agent end with:

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The trailer is the last block of the message (blank line before it); commitlint allows footer lines
up to 200 characters for this reason. Human-only commits carry no trailer.

## Environment variables

- One root `.env` (git-ignored) for the whole monorepo; `.env.example` is committed and documents
  every variable. Copy it once: `cp .env.example .env`.
- Apps load it with `dotenv` (`apps/api/src/env.ts`, `apps/worker/src/env.ts`: an app-local `.env`
  first, then `../../.env`), Prisma through `prisma.config.ts`. Real process env always wins over
  the file — CI and testcontainers depend on that.
- Every app validates its variables once at startup with `createEnv(shape)` (zod) and crashes with a
  readable list when something is missing or malformed.
- Turborepo strict env mode: a task only sees variables declared in `turbo.json` (`globalEnv`:
  `NODE_ENV`, `CI`; `db:migrate` → `DATABASE_URL`; Docker and `TESTCONTAINERS_*` variables pass
  through). Declare new variables there; the lint rule `turbo/no-undeclared-env-vars` then stops
  complaining.
- `NEXT_PUBLIC_*` is the only prefix that reaches the browser. Never put a secret behind it.
- Never commit `.env`; agents are denied reading it (`.claude/settings.json`).
- Variables per app (`apps/api/src/env.ts`, `apps/worker/src/env.ts`, `apps/web/lib/env.ts`):
  - shared: `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`;
  - api: `API_PORT`, `API_URL` (public origin, Better Auth cookies are set for this host),
    `WEB_ORIGIN` (CORS with credentials + `trustedOrigins`), `BETTER_AUTH_SECRET` (≥ 32 chars),
    optional `COOKIE_DOMAIN` (production parent domain);
  - worker: `MAIL_SMTP_URL` (`smtp://localhost:1025` = Mailpit), `MAIL_FROM` (its display name is
    the brand used in emails, `apps/worker/src/mail/mail-from.ts`);
  - api and worker: optional `DISCORD_ALERT_WEBHOOK_URL` (error and fatal alerts,
    `docs/adr/0010-alerts.md`; a secret, since whoever holds it can post to the channel);
  - web: `NEXT_PUBLIC_API_URL`.

## Authentication and sessions

Better Auth (`packages/auth`, ADR `docs/adr/0002-auth.md`) runs inside the API at `/api/auth/*`; the
web app is a plain client of it. Session lifetime, what ends a session, several devices and the
password-link flows are explained in `docs/auth.md`; this section holds the conventions.

- **Cookies, not tokens.** The session lives in an HTTP-only cookie set by the API host (`API_URL`).
  In development `localhost:3000` → `localhost:4000` works because cookies are host-scoped, not
  port-scoped. In production web and api share a parent domain and `COOKIE_DOMAIN` enables
  `crossSubDomainCookies`. The browser sends the cookie with `credentials: "include"` on both the
  auth client and the tRPC link; server components forward the incoming `cookie` header to
  `/api/auth/get-session`.
- **CORS** (`apps/api/src/app.ts`) allows exactly `WEB_ORIGIN` with credentials on `/api/auth/*` and
  `/trpc/*`; every other origin gets no `Access-Control-Allow-Origin`. Better Auth additionally
  checks `trustedOrigins`.
- **Verified email required, no public sign-up.** Users are invited (`user.invite`: `createUser`
  without a password, then a password-reset link by mail through the outbox); setting the password
  from the mailed link marks the email verified, and sign-in is refused (403 `EMAIL_NOT_VERIFIED`)
  before that. Flow and token lifetime: `docs/auth.md`.
- **Rate limit.** `/api/auth/sign-in/*` allows 10 attempts per minute per client IP
  (`X-Forwarded-For` first, else the socket address), then blocks for 60 s with `429` and
  `Retry-After`; `/api/auth/request-password-reset` allows 5 per 15 minutes, then blocks for 15
  minutes (`apps/api/src/middleware/rate-limit.ts`, `RateLimiterRedis` on the shared ioredis
  connection).
- **Per request.** `buildRequestContext` resolves the session once (`auth.api.getSession`) into
  `ctx.user` and builds `ctx.ability`; services never talk to Better Auth for identity. Deactivating
  a user soft-deletes and bans the row and deletes its sessions through the user repository in the
  same transaction (no Better Auth admin call, so it does not depend on the caller's role).
- **Roles** are stored as strings on `users.role` (Better Auth admin plugin) with a foreign key to
  the `roles` catalog, so the database refuses unknown values; the allowed set is `roleSchema` in
  `@repo/validation` and the default is `am` (the legacy STAFF role, labelled AM).

## Testing policy

- Vitest 5, `vitest run` per workspace through Turborepo; the root `vitest.config.ts` lists every
  workspace as a project for one-shot local runs and IDE integration.
- Anything that touches Postgres or Redis uses testcontainers (`@repo/database/test`,
  `@repo/queue/test`; images `postgres:18-alpine` and `redis:8-alpine`, the same as docker-compose
  and CI). Mocks are allowed only for external providers (HTTP, mail, AI).
- Tests assert behaviour (results, rows, jobs, thrown domain errors), not implementation (call
  order, private state).
- Every `*.test.ts` lives in the workspace's `test/` folder, mirroring `src/`
  (`apps/api/test/modules/user/user.service.test.ts` tests `src/modules/user/user.service.ts`);
  workspace-wide integration tests sit at the root of `test/` next to `support.ts` and
  `global-setup.ts`. `vitest.config.ts` includes only `test/**/*.test.ts` (`.tsx` too where
  components are tested in jsdom, see `.claude/rules/testing.md`); `scripts/` has a node:test suite
  run by the root `test:scripts` task.
- Weakening or skipping a test to go green is a review BLOCKER.

Why: a mock of Prisma or Redis proves that the mock works. The containers cost seconds and prove the
migration, the query and the queue semantics at once.

## IDs

Primary keys are UUID v7 (`@default(uuid(7)) @db.Uuid`): globally unique like v4 but time-ordered,
so B-tree indexes stay compact and insertion order is preserved without a serial. `@repo/validation`
exposes `idSchema = z.uuid()`. Job ids derive from row ids (`jobIdFor("email", row.id)`), never from
counters or timestamps.

## Errors

- Services throw domain errors from `apps/api/src/core/errors.ts`: `NotFoundError`,
  `ForbiddenError`, `ConflictError`, `ValidationError` (each with a `code`, an optional `cause` and
  safe `details`).
- `apps/api/src/core/error-mapping.ts` maps them per transport: `toTRPCError` (`NOT_FOUND`,
  `FORBIDDEN`, `CONFLICT`, `BAD_REQUEST`) and `toHttpStatus` (404, 403, 409, 400). Anything else
  becomes `INTERNAL_SERVER_ERROR` with the fixed message "Internal server error" — internals never
  leak to clients; the cause is logged server-side with the `requestId`.
- The tRPC `errorFormatter` adds `requestId` to every error so users can quote it.
- An unknown failure writes `request failed` at `error` (with `path` and `requestId`) and a 5xx
  access line; with a webhook set the two fold into one Discord alert. Domain errors are `warn` and
  never alert (`docs/adr/0010-alerts.md`).
- Database constraint failures are translated once (`translateDatabaseError`, `isUniqueViolation`,
  ... in `packages/database/src/utils/errors.ts`) and turned into domain errors in services. Nothing
  else compares Prisma or Postgres error codes.

## Queue semantics

- Payloads carry IDs only (`{ outboxEmailId, traceId? }`); the worker re-reads the row.
- Producers live in API services and enqueue **after** the transaction commits, via the
  `afterCommit` hook of `withTransaction` (`packages/database/src/utils/transaction.ts`).
- Consumers live only in `apps/worker` (`createWorker` elsewhere is a lint error).
- Job ids are deterministic (`jobIdFor(prefix, id)`, charset `[A-Za-z0-9_-]`), so re-enqueueing is a
  no-op and duplicates collapse.
- Workers are idempotent: re-read the row, no-op if already done, then mark done.
- Queue names are registered in `QUEUE_NAMES`; defaults come from `DEFAULT_JOB_OPTIONS` (5 attempts,
  exponential backoff from 3 s, completed jobs kept 24 h / at most 1000, failed jobs kept 7 days).
- Realtime is "signal + invalidate" over Redis pub/sub (`createPubSub`, separate publisher and
  subscriber connections); messages are IDs, the DB row is the truth.

## Failed jobs and manual retry

Two facts collide: the job id is deterministic (derived from the row), and failed jobs are removed
from Redis after 7 days (`removeOnFail`). While the failed job exists, adding a job with the same id
is a no-op — a naive "retry by re-enqueueing" does nothing. After it is removed, Redis has no memory
of the failure at all — a naive "list failed jobs" shows nothing. Redis can therefore neither block
nor report failures reliably.

The outbox row is the only place that can: `OutboxEmail.status PENDING | SENT | FAILED`, `attempts`,
`lastError`, `sentAt` (`packages/database/src/repositories/outbox-email.repository.ts`). This is how
`apps/worker/src/processors/email.processor.ts` uses it:

- A job for a row that is no longer `PENDING` does nothing (idempotent); a job whose row does not
  exist is dropped with `UnrecoverableError`.
- A transient delivery error (SMTP unreachable) with attempts left → `recordFailedAttempt`
  (`attempts + 1`, `lastError`, still `PENDING`) and BullMQ retries with backoff.
- The last attempt (`job.attemptsStarted >= job.opts.attempts`, 5 by default) → `markFailed`.
- A permanent error — `PermanentMailError` from the mail provider or `TemplateError` from
  `renderEmail` (unknown template, invalid payload) — → `markFailed` on the first attempt and
  `UnrecoverableError`, so BullMQ does not retry.
- The sweeper (`apps/worker/src/schedulers/outbox-sweeper.ts`, a BullMQ 6 job scheduler every 2
  minutes) re-enqueues up to 200 rows that are still `PENDING` after 1 minute, with the same job
  ids. It never touches `FAILED`, so a permanently failing job is not retried forever, and a job
  lost between commit and enqueue (crash, Redis flush, failed after-commit hook) is recovered.
- Manual retry is an operation on the row: `resetToPending(id)` sets `FAILED` back to `PENDING` and
  clears `lastError`; the next sweep (or an explicit `enqueueEmailJob`) delivers it. While the
  failed job still exists in Redis under the same id, a re-add is a no-op until that job is removed
  or retried — the row, not Redis, is where the retry is decided. There is no UI for this yet;
  operators do it with SQL or Prisma Studio.

Every later outbox (notifications, PDF rendering) follows the same shape.

## Docker

`docker-compose.yml` runs `postgres:18-alpine` (override with `POSTGRES_IMAGE` in `.env`, e.g.
`postgis/postgis:18-3.6` when a project needs PostGIS), `dpage/pgadmin4:9` preconfigured from the
`POSTGRES_*` variables, `redis:8-alpine` with append-only persistence, `axllent/mailpit:v1.31` as
the local mail sink (SMTP 1025, UI http://localhost:8025 — every outbox email lands there), and
optionally `redis/redisinsight:3.8` (`docker compose --profile tools up -d`). Healthchecks gate
`yarn docker:up` (`docker compose up -d --wait`); data lives in named volumes.

The same Postgres image is used in three places that must stay on one major: `POSTGRES_IMAGE`
(compose), `TEST_POSTGRES_IMAGE` (testcontainers default in `packages/database/test/index.ts`) and
the CI service container (`.github/workflows/ci.yml`, overridable through the repository variable
`CI_POSTGRES_IMAGE`). All three default to `postgres:18-alpine`, which is multi-arch.

## Versions policy

- Pin exact versions (`.yarnrc.yml` sets `defaultSemverRangePrefix: ""`); no `^` or `~`. The
  lockfile is committed and CI installs with `--immutable`.
- Before adding or upgrading a package run `npm view <pkg> version` and state why the dependency is
  needed. If the latest majors of two packages are incompatible, stop, report and propose the newest
  compatible pair (see `docs/adr/0001-stack.md` for the current ones: TypeScript 6.0 not 7, Prisma 7
  not the 8 release candidate).
- Read current docs (Context7) for Prisma, Better Auth, tRPC, BullMQ, shadcn and Next.js before
  using an API from memory — they change often.
- Dependency swaps and major upgrades get an ADR.

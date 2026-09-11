---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/test/**"
---

# Testing rules

## Runner

- Vitest 5. Each workspace has a `vitest.config.ts` (`defineProject`, `name: "@repo/<pkg>"`,
  `include: ["test/**/*.test.ts"]`) and a `test` script `vitest run`; its `tsconfig.json`
  includes `test/**/*.ts` so tests are type-checked with the code;
  `yarn test` runs them through Turborepo (`test` depends on `^build` and `^db:generate`).
- The root `vitest.config.ts` lists `packages/*/vitest.config.ts` and `apps/*/vitest.config.ts`
  as projects, so `yarn vitest run` from the root (and IDE integration) runs everything at once.
- One workspace: `yarn workspace @repo/api test`. One file:
  `yarn workspace @repo/api vitest run test/core/context.test.ts`.

## Real infrastructure, not mocks

Anything touching Postgres or Redis runs against testcontainers:

- `@repo/database/test` → `startTestDatabase()` starts `postgis/postgis:18-3.6` (override with
  `TEST_POSTGRES_IMAGE`), runs `prisma migrate deploy` against it and returns
  `{ container, connectionString, prisma, stop }`.
- `@repo/queue/test` → `startTestRedis()` starts `redis:8-alpine` (override with
  `TEST_REDIS_IMAGE`) and returns `{ container, url, stop }`.
- A workspace that needs them has a `test/global-setup.ts` that starts the containers once per run
  and publishes their URLs with `project.provide(...)`; tests read them with
  `inject("databaseUrl")` / `inject("redisUrl")` and create their own client in `beforeAll`
  (`createPrismaClient({ connectionString: inject("databaseUrl") })`,
  `createRedisConnection(inject("redisUrl"))` + `waitForRedis`). Declare the keys with
  `declare module "vitest" { interface ProvidedContext { databaseUrl: string } }`.
  `apps/api/test/global-setup.ts` starts both and is the template for workspaces that need both.
- Docker must be running. `turbo.json` passes `DOCKER_*` and `TESTCONTAINERS_*` through to tasks.
  Hook timeouts are generous (`hookTimeout` 120–180 s) because the first image pull is slow.

Mocks are allowed only for **external providers** we do not run locally: HTTP APIs, mail, payment,
AI. The one existing mock is `createMemoryMailProvider` (`apps/worker/src/mail/memory-mail-provider.ts`),
an implementation of the `MailProvider` interface with `failFirst` / `alwaysFailPermanently` knobs.
Never mock Prisma, Redis, BullMQ, Better Auth, repositories or services of this repo.

## Test harnesses — copy these, do not reinvent them

`apps/api/test/support.ts` (real Postgres + Redis, real Better Auth):

| Helper                                        | What it gives you                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createHarness()`                             | `{ db, redis, auth, emailQueue, logger, sentMails, stop }`; call `stop()` in `afterAll`                  |
| `signedInUser(h, { role, department, name })` | registers via Better Auth, marks verified + role in the DB, signs in; returns `{ user, email, headers }` |
| `contextFor(h, headers?)`                     | a `RequestContext` built by `buildRequestContext` for those headers (anonymous when omitted)             |
| `cookieHeaderFrom(response)`                  | `Cookie` header value from a `Set-Cookie` response, for follow-up HTTP requests                          |
| `TEST_WEB_ORIGIN`, `TEST_PASSWORD`            | constants used by the HTTP tests                                                                         |

Service tests call the service with `await contextFor(h, user.headers)`; router tests wrap the same
context in `createCallerFactory(appRouter)`; HTTP tests build `createApp(...)` from the harness
(`logger`, `db`, `redis`, `auth`, `webOrigin`, optional `signInRateLimiter`) and use
`app.request(...)`.

`apps/worker/test/support.ts` (real Postgres + Redis):

| Helper                                                     | What it gives you                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `createWorkerHarness()`                                    | `{ db, connection, logger, stop }`                                                                                  |
| `isolatedEmailQueue(connection, { attempts, backoffMs })`  | a uniquely named `EmailQueue` so parallel tests never share jobs; pass `name` as `queueName` to `createEmailWorker` |
| `createPendingEmail(db, { to, template, payload, ageMs })` | an `OutboxEmail` row in `PENDING`, optionally back-dated for sweeper tests                                          |
| `waitForFinalStatus(db, id)`                               | polls until the row leaves `PENDING` (or 10 s)                                                                      |
| `waitForJobDone(queue, jobId)`                             | polls until BullMQ reports `completed` / `failed`                                                                   |

Both `test/global-setup.ts` files start Postgres and Redis once per workspace run and are the
template for any workspace that needs both.

`apps/api/vitest.config.ts` sets `fileParallelism: false`: all API test files share one database,
and the user service enforces a global invariant ("at least one active admin") that a parallel file
creating and demoting admins would break. Worker and package tests keep the default parallelism and
isolate through unique names instead.

## Test behaviour, not implementation

- Assert on outcomes: the returned value, the row in the database, the job in the queue, the HTTP
  status, the thrown domain error (`await expect(promise).rejects.toBeInstanceOf(NotFoundError)`).
- Do not assert call counts, call order or private state; do not spy on internal modules.
- Name tests as behaviour: `it("refuses to demote the last admin")`, not `it("calls update")`.
- Each test creates its own data with unique values (`crypto.randomUUID()`) — the container is
  shared by the whole package run — and cleans up what it started (`worker.close()`,
  `queue.obliterate({ force: true })`, disconnect clients) in `afterAll` / `finally`.
- Routers are tested through `createCallerFactory(appRouter)` with a context from `contextFor`;
  the HTTP surface through `createApp(deps).request("/health")` (Hono). `createApp` accepts
  `probes` (simulate dependency failures) and `signInRateLimiter` (a small limit with a unique
  `keyPrefix`) so tests never depend on the production settings.

## Where tests live

- Every `*.test.ts` lives in the workspace's `test/` folder, never in `src/`. The `test/` tree
  mirrors `src/`: `apps/api/test/modules/user/user.service.test.ts` tests
  `apps/api/src/modules/user/user.service.ts`;
  `packages/database/test/repositories/user.repository.test.ts`,
  `apps/api/test/trpc/routers/user.router.test.ts`, `packages/queue/test/queue.test.ts`,
  `packages/validation/test/env.test.ts`.
- Integration tests spanning a workspace (HTTP + database + Redis, migrations) sit at the root of
  that `test/` folder (`apps/api/test/app.test.ts`, `apps/api/test/auth-http.test.ts`), alongside
  `test/global-setup.ts`, the helpers in `test/support.ts` and a package's public test entry
  (`packages/database/test/index.ts`, `packages/queue/test/index.ts`).
- Imports inside a test are relative to its mirrored position
  (`../../../src/modules/user/user.service`, `../../support`).
- The ability matrix test (`packages/permissions/test/ability.test.ts`) is the permission spec.

## Never

- `.skip`, `.only`, `--passWithNoTests`, `try { expect } catch {}`, loosened assertions or deleted
  cases to make a run green — the reviewer marks it `BLOCKER`.
- `console.log` in tests (`no-console` is a lint error in tests too); assertions and their messages
  carry the information.
- Tests that depend on execution order or on state left by another test.
- Snapshots of large objects as the only assertion.

## Lint in tests

`packages/eslint-config/base.js` relaxes `no-non-null-assertion`, `no-unsafe-assignment`,
`no-unsafe-member-access`, `no-unsafe-argument`, `no-empty-function`, `require-await` and
`unbound-method` for `**/*.test.{ts,tsx}` and `**/test/**/*.ts`. Everything else applies.

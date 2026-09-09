---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/test/**"
---

# Testing rules

## Runner

- Vitest 5. Each workspace has a `vitest.config.ts` (`defineProject`, `name: "@repo/<pkg>"`,
  `include: ["src/**/*.test.ts", "test/**/*.test.ts"]`) and a `test` script `vitest run`;
  `yarn test` runs them through Turborepo (`test` depends on `^build` and `^db:generate`).
- The root `vitest.config.ts` lists `packages/*/vitest.config.ts` and `apps/*/vitest.config.ts`
  as projects, so `yarn vitest run` from the root (and IDE integration) runs everything at once.
- One workspace: `yarn workspace @repo/api test`. One file:
  `yarn workspace @repo/api vitest run src/core/context.test.ts`.

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

Mocks are allowed only for **external providers** we do not run locally: HTTP APIs, mail
(`MailProvider` interface, Phase 1), payment, AI. Never mock Prisma, Redis, BullMQ, repositories
or services of this repo.

## Test behaviour, not implementation

- Assert on outcomes: the returned value, the row in the database, the job in the queue, the HTTP
  status, the thrown domain error (`await expect(promise).rejects.toBeInstanceOf(NotFoundError)`).
- Do not assert call counts, call order or private state; do not spy on internal modules.
- Name tests as behaviour: `it("refuses to demote the last admin")`, not `it("calls update")`.
- Each test creates its own data with unique values (`crypto.randomUUID()`) — the container is
  shared by the whole package run — and cleans up what it started (`worker.close()`,
  `queue.obliterate({ force: true })`, disconnect clients) in `afterAll` / `finally`.
- Routers are tested through `createCallerFactory(appRouter)` with a hand-built
  `RequestContext`; the HTTP surface through `createApp(deps).request("/health")` (Hono).
  `createApp` accepts `probes` so dependency failures can be simulated without breaking the
  containers.

## Where tests live

- Unit and module tests: `*.test.ts` next to the file they test (`user.service.test.ts`).
- Integration tests spanning a workspace (HTTP + database + Redis, migrations): `test/*.test.ts`
  in that workspace, alongside `test/global-setup.ts` and helpers (`test/index.ts`).
- The ability matrix test (`packages/permissions`, Phase 1) is the permission spec.

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

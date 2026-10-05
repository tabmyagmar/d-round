---
name: testing
description:
  Use when writing or fixing a test, adding testcontainers to a workspace, or deciding what may be
  mocked.
---

# Testing how-to

Rules (placement, harness tables, what the tests must assert): `.claude/rules/testing.md`. This
skill is the mechanical part.

## Commands

| Goal                           | Command                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| Everything (Turborepo, cached) | `yarn test`                                                     |
| Everything, one process        | `yarn vitest run` (root `vitest.config.ts` projects)            |
| One workspace                  | `yarn workspace @repo/api test`                                 |
| One file                       | `yarn workspace @repo/api vitest run test/core/context.test.ts` |
| Full gate                      | `yarn verify` (lint, typecheck, test, build, format:check)      |
| Full gate, no Turbo cache      | `yarn turbo run lint typecheck test build --force --continue`   |

Docker must be running for anything that uses testcontainers. Add `--reporter=verbose` to see every
case name; the first run after a change is the red run, keep its failing names for the report.

## Placement

A test lives in the workspace's `test/` folder, mirrors the `src/` path and imports relatively
(`src/modules/user/user.service.ts` → `test/modules/user/user.service.test.ts`, importing
`../../../src/modules/user/user.service` and `../../support`). `describe` = the unit, `it` = a
behaviour ("refuses to demote the last admin"). A test outside `test/` is not run.

## Testcontainers lifecycle

```ts
// test/global-setup.ts — one container per workspace run
import type { TestProject } from "vitest/node";

import { startTestDatabase, type TestDatabase } from "@repo/database/test";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let database: TestDatabase | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  database = await startTestDatabase({ seedReferenceData: true }); // omit for the database package
  project.provide("databaseUrl", database.connectionString);
};

export const teardown = async (): Promise<void> => {
  await database?.stop();
};
```

`vitest.config.ts` lists it (`globalSetup: ["./test/global-setup.ts"]`, `environment: "node"`,
`include: ["test/**/*.test.ts"]`, `testTimeout: 30_000`, `hookTimeout: 180_000`). In tests:
`inject("databaseUrl")` / `inject("redisUrl")`, create the client in `beforeAll`, disconnect in
`afterAll`. `apps/api/test/global-setup.ts` starts Postgres and Redis and is the template for a
workspace that needs both.

## Harnesses — copy the real tests

- API: `apps/api/test/support.ts` (`createHarness`, `signedInUser`, `contextFor`,
  `cookieHeaderFrom`); service example `apps/api/test/modules/user/user.service.test.ts`, router
  example `apps/api/test/trpc/routers/user.router.test.ts`, HTTP example
  `apps/api/test/auth-http.test.ts`. API files run sequentially (`fileParallelism: false`) because
  the last-admin invariant is global. Grants are read at session lookup: insert a `userPermission`
  row before `contextFor`, never after.
- Worker: `apps/worker/test/support.ts` (`createWorkerHarness`, `isolatedEmailQueue`,
  `createPendingEmail`, `waitForFinalStatus`, `waitForJobDone`); example
  `apps/worker/test/processors/email.processor.test.ts` — always `worker.close()`,
  `queue.obliterate({ force: true })` and `queue.close()` in `finally`.
- Database package: tests share one container in parallel, so a test that must not leave rows behind
  runs inside `prisma.$transaction` and throws a sentinel to roll back
  (`packages/database/test/repositories/permission.repository.test.ts`); counts that other files
  change concurrently are measured as a before/after delta inside a `RepeatableRead` transaction
  (`user.repository.test.ts`).

## What may be mocked

| Thing                               | Mock? | Instead                                                                        |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------ |
| Postgres, Prisma, repositories      | no    | testcontainers via `@repo/database/test`                                       |
| Redis, BullMQ queues and workers    | no    | testcontainers via `@repo/queue/test`                                          |
| Our own services and modules        | no    | call them                                                                      |
| Logger                              | no    | `createLogger({ name, level: "silent" })`                                      |
| Better Auth                         | no    | `createHarness()` runs the real thing                                          |
| External HTTP, mail or AI providers | yes   | an interface plus a fake: `createMemoryMailProvider` implements `MailProvider` |
| Time                                | yes   | `vi.useFakeTimers()`, or back-date rows (`createPendingEmail(db, { ageMs })`)  |

## Gotchas

- Vitest `inject` types come from the `declare module "vitest"` block — without it `inject("x")` is
  a type error.
- Do not `console.log` in tests (lint error); assertions and their messages carry the information.
- Lint relaxations for tests (`no-non-null-assertion`, `no-unsafe-*`) are in the base preset;
  `no-console` and the layer rules still apply.
- A testcontainer port race can fail a run before any test starts; re-run once and report both.
- Flaky? Fix the cause (unique data, missing `await`, timeouts); never add retries or `.skip`.

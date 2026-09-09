---
name: testing
description: Use when writing or fixing a test, adding testcontainers to a workspace, or deciding what may be mocked.
---

# Testing how-to

Rules: `.claude/rules/testing.md`. This skill is the mechanical part.

## Commands

| Goal                           | Command                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| Everything (Turborepo, cached) | `yarn test`                                                    |
| Everything, one process        | `yarn vitest run` (root `vitest.config.ts` projects)           |
| One workspace                  | `yarn workspace @repo/api test`                                |
| One file                       | `yarn workspace @repo/api vitest run src/core/context.test.ts` |
| Full gate                      | `yarn verify` (lint, typecheck, test, build, format:check)     |

Docker must be running for anything that uses testcontainers.

## Naming and placement

- `<file>.test.ts` next to `<file>.ts`; `describe` = the unit under test, `it` = a behaviour
  ("returns NotFoundError when the user is soft-deleted").
- Integration tests for a workspace in `test/*.test.ts`; helpers in `test/index.ts`.
- Test data via small factory helpers in the workspace's `test/` folder
  (`createUser({ role: "admin" })`), each call unique (`crypto.randomUUID()`).

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
  database = await startTestDatabase();
  project.provide("databaseUrl", database.connectionString);
};

export const teardown = async (): Promise<void> => {
  await database?.stop();
};
```

```ts
// vitest.config.ts
export default defineProject({
  test: {
    name: "@repo/<pkg>",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
```

In tests: `inject("databaseUrl")` / `inject("redisUrl")`, create the client in `beforeAll`,
disconnect in `afterAll`. `apps/api/test/global-setup.ts` starts both Postgres and Redis and is the
template for a workspace that needs both.

<!-- Phase 1: add real example (user.service.test.ts with factories; email outbox tests) -->

## What may be mocked

| Thing                               | Mock? | Instead                                           |
| ----------------------------------- | ----- | ------------------------------------------------- |
| Postgres, Prisma, repositories      | no    | testcontainers via `@repo/database/test`          |
| Redis, BullMQ queues and workers    | no    | testcontainers via `@repo/queue/test`             |
| Our own services and modules        | no    | call them                                         |
| Logger                              | no    | `createLogger({ name, level: "silent" })`         |
| External HTTP, mail or AI providers | yes   | an interface plus a fake implementation           |
| Time                                | yes   | `vi.useFakeTimers()` when behaviour depends on it |

## Gotchas

- Vitest `inject` types come from the `declare module "vitest"` block — without it `inject("x")`
  is a type error.
- Do not `console.log` in tests (lint error); assertions and their messages carry the
  information.
- Clean up queues and workers in `finally`; a hanging worker keeps the run alive.
- Lint relaxations for tests (`no-non-null-assertion`, `no-unsafe-*`) are in the base preset;
  `no-console` and the layer rules still apply.
- Flaky? Fix the cause (unique data, missing `await`, timeouts); never add retries or `.skip`.

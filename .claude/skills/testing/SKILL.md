---
name: testing
description: Use when writing or fixing a test, adding testcontainers to a workspace, or deciding what may be mocked.
---

# Testing how-to

Rules: `.claude/rules/testing.md`. This skill is the mechanical part.

## Commands

| Goal                           | Command                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| Everything (Turborepo, cached) | `yarn test`                                                     |
| Everything, one process        | `yarn vitest run` (root `vitest.config.ts` projects)            |
| One workspace                  | `yarn workspace @repo/api test`                                 |
| One file                       | `yarn workspace @repo/api vitest run test/core/context.test.ts` |
| Full gate                      | `yarn verify` (lint, typecheck, test, build, format:check)      |

Docker must be running for anything that uses testcontainers.

## Naming and placement

- Every test lives in the workspace's `test/` folder (never in `src/`) and mirrors the `src/`
  path: `src/modules/user/user.service.ts` → `test/modules/user/user.service.test.ts`,
  `src/repositories/user.repository.ts` → `test/repositories/user.repository.test.ts`,
  `src/queue.ts` → `test/queue.test.ts`. `describe` = the unit under test, `it` = a behaviour
  ("returns NotFoundError when the user is soft-deleted").
- Integration tests for a workspace at the root of `test/` (`test/app.test.ts`); helpers in
  `test/support.ts`, container lifecycle in `test/global-setup.ts`, a package's public test entry
  in `test/index.ts`.
- `vitest.config.ts` has `include: ["test/**/*.test.ts"]` and `tsconfig.json` includes
  `test/**/*.ts`; a test outside `test/` is not run.
- Test data via the harness helpers in the workspace's `test/support.ts`
  (`signedInUser(h, { role: "admin" })`, `createPendingEmail(db)`), each call unique
  (`crypto.randomUUID()`).

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
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
```

In tests: `inject("databaseUrl")` / `inject("redisUrl")`, create the client in `beforeAll`,
disconnect in `afterAll`. `apps/api/test/global-setup.ts` and `apps/worker/test/global-setup.ts`
start both Postgres and Redis and are the template for a workspace that needs both.

## The harnesses

API (`apps/api/test/support.ts`) — used by service, router and HTTP tests:

```ts
// apps/api/test/modules/user/user.service.test.ts
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

import * as userService from "../../../src/modules/user/user.service";

let h: TestHarness;
beforeAll(async () => {
  h = await createHarness(); // real Postgres + Redis + Better Auth, silent logger
});
afterAll(async () => {
  await h.stop();
});

it("is admin-only and refuses to demote the last admin", async () => {
  const admin = await signedInUser(h, { role: "admin" });
  const member = await signedInUser(h);
  const ctx = await contextFor(h, admin.headers);

  await expect(
    userService.changeRole(await contextFor(h, member.headers), {
      userId: admin.user.id,
      role: "member",
    }),
  ).rejects.toBeInstanceOf(ForbiddenError);
  // ... then demote every other admin and assert the ConflictError on the last one
});
```

`apps/api/vitest.config.ts` runs files sequentially (`fileParallelism: false`) because the "last
admin" invariant is global to the shared database.

Worker (`apps/worker/test/support.ts`) — `createWorkerHarness`, `isolatedEmailQueue`,
`createPendingEmail`, `waitForFinalStatus`, `waitForJobDone`:

```ts
const { name, queue } = isolatedEmailQueue(h.connection, { attempts: 3, backoffMs: 20 });
const provider = createMemoryMailProvider({ failFirst: 2 });
const worker = createEmailWorker({ ...h, provider, queueName: name });
try {
  const row = await createPendingEmail(h.db);
  await enqueueEmailJob(queue, row.id);
  const final = await waitForFinalStatus(h.db, row.id);
  expect(final.status).toBe("SENT");
  expect(final.attempts).toBe(3);
} finally {
  await worker.close();
  await queue.obliterate({ force: true });
  await queue.close();
}
```

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

- Vitest `inject` types come from the `declare module "vitest"` block — without it `inject("x")`
  is a type error.
- Do not `console.log` in tests (lint error); assertions and their messages carry the
  information.
- Clean up queues and workers in `finally`; a hanging worker keeps the run alive.
- Lint relaxations for tests (`no-non-null-assertion`, `no-unsafe-*`) are in the base preset;
  `no-console` and the layer rules still apply.
- Flaky? Fix the cause (unique data, missing `await`, timeouts); never add retries or `.skip`.

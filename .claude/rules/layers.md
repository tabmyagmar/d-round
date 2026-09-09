# Layer contract

Every request flows in one direction. A layer may import from itself, from the layer directly
below it, and from shared packages — never upward and never around a layer.

```text
transport    apps/api/src/trpc            (later: apps/api/src/graphql, apps/api/src/rest)
    |        zod input -> ability check -> service call. No business logic.
    v
service      apps/api/src/modules/<name>/<name>.service.ts
    |        business rules, workflow-state checks, transactions, after-commit side effects.
    |        Throws domain errors from apps/api/src/core/errors.ts — never TRPCError.
    v
repository   packages/database/src/repositories/<name>.repository.ts
    |        pure data access, Prisma types in and out. No validation, business rules or queue.
    v
prisma       packages/database/src/client.ts  ->  PostgreSQL
```

Side processes:

- `apps/worker` consumes queues and reuses `@repo/database` repositories and shared packages. It
  never imports `@repo/api`.
- `apps/web` calls the API over tRPC and may import API **types** only
  (`import type { AppRouter } from "@repo/api/router"`). It never imports `@repo/database`,
  `@repo/queue` or `@repo/logger`.
- `apps/api/src/core` (context, errors, error-mapping) is transport-agnostic glue. Services import
  `core/errors.ts` and the `RequestContext` type; only transports import `core/error-mapping.ts`.

## Element types

`packages/eslint-config/boundaries.js` classifies every file; the first matching descriptor wins.

| Element         | Paths                                                            |
| --------------- | ---------------------------------------------------------------- |
| `api-transport` | `apps/api/src/trpc`, `apps/api/src/graphql`, `apps/api/src/rest` |
| `api-service`   | `apps/api/src/modules`                                           |
| `api-core`      | `apps/api/src/core`                                              |
| `api-app`       | everything else under `apps/api/src` (composition root)          |
| `repository`    | `packages/database/src/repositories`                             |
| `database`      | the rest of `packages/database`                                  |
| `worker`        | `apps/worker/src`                                                |
| `web`           | `apps/web`                                                       |
| `ui`            | `packages/ui`                                                    |
| `shared`        | every other `packages/*`                                         |

## Allowed import directions

| From            | May import                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api-transport` | `api-transport`, `api-service`, `api-core`, shared packages; `@repo/database` **types only**                     |
| `api-service`   | `api-service`, `api-core`, shared packages (`@repo/database`, `@repo/queue`, `@repo/validation`, `@repo/logger`) |
| `api-core`      | `api-core`, shared packages                                                                                      |
| `api-app`       | every layer inside `apps/api` (it wires them together) and shared packages                                       |
| `repository`    | `repository`, `database`                                                                                         |
| `database`      | `database`, `repository`                                                                                         |
| `worker`        | `worker`, shared packages                                                                                        |
| `web`           | `web`, `@repo/ui`, `@repo/validation`; `@repo/api` **types only**                                                |
| `ui`            | `ui`, browser-safe shared packages (`@repo/validation`)                                                          |
| `shared`        | other shared packages — never an app                                                                             |

Third-party and Node built-in modules are allowed everywhere except where a policy forbids them:
transport libraries (`@trpc/*`, `hono`, `@hono/*`, `graphql`, `graphql-yoga`) in services,
repositories, the database package and the worker; `createWorker` outside the worker.

## Forbidden — these fail `yarn lint`

```ts
// apps/api/src/modules/user/user.service.ts
import { TRPCError } from "@trpc/server"; // service importing a transport library
import { protectedProcedure } from "../trpc/init"; // service importing transport code

// apps/api/src/trpc/routers/user.router.ts
import { getPrismaClient } from "@repo/database"; // transport importing a data-layer VALUE
// (import type { User } from "@repo/database" is fine)

// packages/database/src/repositories/user.repository.ts
import { z } from "zod"; // repositories do not validate
import { updateProfileSchema } from "@repo/validation";
import { createQueue } from "@repo/queue"; // repositories do not enqueue

// apps/worker/src/processors/email.processor.ts
import { appRouter } from "@repo/api/router"; // the worker never depends on the API

// apps/web/src/app/users/page.tsx
import { getPrismaClient } from "@repo/database"; // browser code never sees the database
import { createQueue } from "@repo/queue";

// anywhere except apps/worker
import { createWorker } from "@repo/queue";
// -> "Queue consumers (createWorker) may only be created in apps/worker"
```

## Composition roots may import anything

`apps/api/src/index.ts`, `app.ts`, `env.ts`, `middleware/`, `health/` and `lib/` form the
`api-app` element: they create the database client, the Redis connection and the logger, build the
Hono app, mount transports and register graceful shutdown. That is the only place where all layers
meet. `apps/worker/src/index.ts` plays the same role inside the worker.

## Enforcement

- Rule `boundaries/dependencies` (`eslint-plugin-boundaries`) configured in
  `packages/eslint-config/boundaries.js` with `default: "disallow"`; policies are evaluated in
  order and the last matching policy wins. `@repo/*` imports are matched by package name, so the
  rules do not depend on how workspace symlinks resolve.
- A violation is an ESLint error: `yarn lint` fails, `lint-staged` blocks the commit, CI fails.
- Never add `eslint-disable` for `boundaries/dependencies`. A boundary error means the code is in
  the wrong layer — move it: business rule into the service, data access into the repository,
  transport concern into the router or `core/error-mapping.ts`.
- Adding a transport later (`apps/api/src/graphql`, `apps/api/src/rest`) needs no rule change:
  those folders are already classified as `api-transport`.

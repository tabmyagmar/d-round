---
paths:
  - "apps/api/src/modules/**"
---

# Module template (mandatory)

A module is one domain aggregate (user, template, submission, ...). Every module consists of the
same four files plus their tests, and is wired into the router the same way. Do not invent a
different shape and do not merge files "because the module is small". Phase 1's `user` module is
the reference implementation (to be added) — copy its structure for every later module.

## The four files for a module `<name>`

| #   | File                                                      | Layer      | Contains                                                                     |
| --- | --------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| 1   | `packages/validation/src/<name>.schema.ts`                | validation | zod input schemas, shared with `apps/web` forms via `@repo/validation`       |
| 2   | `packages/database/src/repositories/<name>.repository.ts` | repository | `create<Name>Repository(db: DbClient)`: pure data access, Prisma types       |
| 3   | `apps/api/src/modules/<name>/<name>.service.ts`           | service    | business rules; every function takes `ctx: RequestContext` as FIRST argument |
| 4   | `apps/api/src/trpc/routers/<name>.router.ts`              | transport  | procedures: zod input → ability check → service call, nothing else           |

Plus:

- Tests next to each file: `<name>.schema.test.ts`, `<name>.repository.test.ts`,
  `<name>.service.test.ts`, `<name>.router.test.ts` (see `.claude/rules/testing.md`).
- Registration: add the router to `apps/api/src/trpc/router.ts`
  (`router({ health: healthRouter, <name>: <name>Router })`) and the repository to the barrel
  `packages/database/src/repositories/index.ts`.
- Export the module's Prisma model types from `packages/database/src/index.ts` — consumers never
  import from `src/generated`.

## 1. Schema — `packages/validation/src/<name>.schema.ts`

```ts
import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";

export const update<Name>Schema = z.object({ id: idSchema /* , fields */ });
export const list<Name>sSchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
});

export type Update<Name>Input = z.infer<typeof update<Name>Schema>;
```

Schemas describe **input shape** only. Rules that need data (uniqueness, state transitions, "last
admin") belong in the service. Re-export from `packages/validation/src/index.ts`.

## 2. Repository — `packages/database/src/repositories/<name>.repository.ts`

```ts
import { buildPage, normalizePage, toSkipTake, type PageParams } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

export const create<Name>Repository = (db: DbClient) => ({
  findById: (id: string) => db.<name>.findFirst({ where: { id, deletedAt: null } }),
  findMany: async (params: Partial<PageParams>) => {
    const page = normalizePage(params);
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      db.<name>.findMany({ where, ...toSkipTake(page), orderBy: { createdAt: "desc" } }),
      db.<name>.count({ where }),
    ]);
    return buildPage(items, total, page);
  },
  update: (id: string, data: Prisma.<Name>UpdateInput) => db.<name>.update({ where: { id }, data }),
  softDelete: (id: string) =>
    db.<name>.update({ where: { id }, data: { deletedAt: new Date() } }),
});

export type <Name>Repository = ReturnType<typeof create<Name>Repository>;
```

`DbClient = PrismaClient | Prisma.TransactionClient`, so the same factory works inside
`withTransaction` (`create<Name>Repository(tx)`). No zod, no `@repo/validation`, no `@repo/queue`,
no business decisions — the linter rejects the imports and the reviewer rejects the rest
(`.claude/rules/repositories.md`).

## 3. Service — `apps/api/src/modules/<name>/<name>.service.ts`

```ts
import { create<Name>Repository, isUniqueViolation } from "@repo/database";
import type { Update<Name>Input } from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";

export const getById = async (ctx: RequestContext, id: string) => {
  const found = await create<Name>Repository(ctx.db).findById(id);
  if (!found) {
    throw new NotFoundError("<Name>", id);
  }
  return found;
};

export const update = async (ctx: RequestContext, input: Update<Name>Input) => {
  const current = await getById(ctx, input.id);
  // Stateful / workflow checks live here — not in CASL, not in the router.
  if (!canBeUpdated(current)) {
    throw new ForbiddenError("<Name> can no longer be updated");
  }
  try {
    return await create<Name>Repository(ctx.db).update(input.id, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("<Name> already exists", { cause: error });
    }
    throw error;
  }
};
```

Rules:

- `ctx: RequestContext` (`apps/api/src/core/context.ts`) is always the first parameter. It carries
  `requestId`, `logger`, `user`, `ability`, `db`, `redis`. Log through `ctx.logger`, never
  `console`.
- Throw only `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError` from
  `apps/api/src/core/errors.ts`. Never `TRPCError`, never a bare `Error` for an expected failure.
- Translate database constraint failures here with `translateDatabaseError` /
  `isUniqueViolation` from `@repo/database`; nothing else compares Prisma or Postgres error codes.
- Multi-statement writes use `withTransaction(ctx.db, async ({ tx, afterCommit }) => ...)`
  (`@repo/database`); queue producers and other side effects are registered with `afterCommit`
  and never run inside the transaction (`.claude/rules/queue.md`).
- Named exports, one function per concern, no default export, no transport imports.
- The `health` service is the single exception to "ctx first": it is infrastructure-level and runs
  before any request context exists.

## 4. Router — `apps/api/src/trpc/routers/<name>.router.ts`

```ts
import { idSchema, update<Name>Schema } from "@repo/validation";

import * as <name>Service from "../../modules/<name>/<name>.service";
import { protectedProcedure, router } from "../init";

export const <name>Router = router({
  byId: protectedProcedure
    .input(idSchema)
    // ability check — Phase 1: requireAbility("read", "<Name>") from packages/permissions
    .query(({ ctx, input }) => <name>Service.getById(ctx, input)),
  update: protectedProcedure
    .input(update<Name>Schema)
    // ability check — Phase 1: requireAbility("update", "<Name>")
    .mutation(({ ctx, input }) => <name>Service.update(ctx, input)),
});
```

Rules:

- Every procedure is exactly `input(zodSchema)` → ability check → one service call. No `if`, no
  Prisma, no result shaping, no try/catch — `apps/api/src/trpc/init.ts` already maps domain errors
  to `TRPCError` and adds `requestId` to the error payload.
- Non-public procedures use `protectedProcedure` and an ability check before the service call
  (`.claude/rules/permissions.md`). `publicProcedure` is for health and auth-less endpoints only.
- Register in `apps/api/src/trpc/router.ts`; `AppRouter` is the type `apps/web` consumes.

## Checklist before you call a module done

- [ ] Four files exist with the exact names and suffixes above; kebab-case; named exports.
- [ ] Service functions take `ctx: RequestContext` first and throw only domain errors.
- [ ] Repository contains no validation, business rules or queue code.
- [ ] Every non-public procedure has an ability check.
- [ ] Tests next to each file; anything touching Postgres uses testcontainers.
- [ ] Router registered in `router.ts`; repository exported from the barrel; model types exported
      from `packages/database/src/index.ts`.
- [ ] Schema change (if any) has a migration and an ADR line (`.claude/rules/migrations.md`).
- [ ] `yarn verify` is green.

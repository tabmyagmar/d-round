---
paths:
  - "packages/database/**"
---

# Repositories and the database package

`packages/database` (`@repo/database`) owns Prisma, the generated client, the repositories and the
database utilities. It is the only workspace that talks to PostgreSQL.

## Repositories are data access, nothing else

- One file per aggregate: `src/repositories/<name>.repository.ts` exporting a factory
  `create<Name>Repository(db: DbClient)` whose methods are thin Prisma calls, plus
  `export type <Name>Repository = ReturnType<typeof create<Name>Repository>`. Re-export it from
  the barrel `src/repositories/index.ts`.
- `DbClient = PrismaClient | Prisma.TransactionClient` (`src/utils/transaction.ts`), so the same
  factory runs inside a transaction: `create<Name>Repository(tx)`.
- Inputs and outputs are Prisma types (`Prisma.<Name>WhereInput`, `Prisma.<Name>UpdateInput`,
  model types). Expose model types to the rest of the repo through `src/index.ts`
  (`export type { HealthCheck } from "./generated/prisma/client"`); nobody imports `src/generated`
  directly.
- Forbidden inside repositories, lint-enforced by `boundaries/dependencies`: `zod`,
  `@repo/validation`, `@repo/queue` and every transport library. Forbidden by review: business
  rules ("cannot demote the last admin"), authorization decisions, workflow-state checks, logging
  of request data, and throwing domain errors — repositories let Prisma/pg errors bubble up.
- A repository method runs one query, or one obviously related pair such as `findMany` + `count`
  for a page. Composing several writes into a unit of work is the service's job, via
  `withTransaction`.

## Raw SQL only here

`$queryRaw` / `$executeRaw` are allowed only in repositories, only as tagged templates (parameters
are bound, never interpolated), never `$queryRawUnsafe` with user input. Columns Prisma cannot
model (PostGIS geometry, Phase 7) are declared with `Unsupported("...")` in the schema and accessed
through raw queries in a repository.

## Soft delete

Models that support soft delete carry `deletedAt DateTime? @map("deleted_at")`. Read methods
filter `deletedAt: null` by default; a method that must see deleted rows says so in its name
(`findByIdIncludingDeleted`). `softDelete(id)` sets `deletedAt: new Date()`; there is no
hard-delete method unless a ticket explicitly asks for one.

## Pagination

Use `normalizePage`, `toSkipTake` and `buildPage` from `src/utils/pagination.ts`
(`DEFAULT_PER_PAGE = 20`, `MAX_PER_PAGE = 100`). `normalizePage` clamps caller input —
repositories never trust page parameters — and `buildPage(items, total, page)` returns the shared
`PageResult<T>` (`items`, `total`, `page`, `perPage`, `totalPages`, `hasNext`, `hasPrev`).

```ts
findMany: async (params: Partial<PageParams>, where: Prisma.UserWhereInput = {}) => {
  const page = normalizePage(params);
  const scoped = { ...where, deletedAt: null };
  const [items, total] = await Promise.all([
    db.user.findMany({ where: scoped, ...toSkipTake(page), orderBy: { createdAt: "desc" } }),
    db.user.count({ where: scoped }),
  ]);
  return buildPage(items, total, page);
},
```

## Errors

Repositories do not catch. Services translate with `translateDatabaseError(error)` or the guards
`isUniqueViolation`, `isForeignKeyViolation`, `isRecordNotFound` (`src/utils/errors.ts`) and throw
the matching domain error (`ConflictError`, `NotFoundError`). `PG_ERROR_CODES` and
`PRISMA_ERROR_CODES` are compared in that file only.

## Transactions and after-commit hooks

```ts
import { withTransaction } from "@repo/database";

await withTransaction(ctx.db, async ({ tx, afterCommit }) => {
  const row = await createOutboxEmailRepository(tx).create(data);
  afterCommit(() =>
    emailQueue.add("send", { outboxEmailId: row.id }, { jobId: jobIdFor("email", row.id) }),
  );
  return row;
});
```

- `withTransaction(prisma, callback, options?)` (`src/utils/transaction.ts`) opens an interactive
  transaction and passes `tx` to the callback.
- Hooks registered with `afterCommit` run sequentially **only after the commit succeeded** and
  never on rollback. Queue producers, notifications and cache invalidation go there — never inside
  the transaction body.
- A failing hook does not undo the commit: failures are collected and thrown as
  `AfterCommitError` once every hook has run (or handed to `options.onAfterCommitError`). Hooks
  must be safe to retry; for queue producers the sweeper (`.claude/rules/queue.md`) covers the case
  where the enqueue itself failed.
- `isolationLevel`, `maxWait` and `timeout` go in `options` when the defaults are not enough.

## Client

`src/client.ts`: `createPrismaClient({ connectionString, maxConnections? })` builds a
`PrismaClient` on the `@prisma/adapter-pg` driver adapter (required by Prisma 7). Long-running apps
use the process singleton `getPrismaClient(...)` / `disconnectPrismaClient()`; tests create one
client per container (`@repo/database/test`). Never `new PrismaClient()` anywhere else.

## Tests

Repository tests live next to the repository (`<name>.repository.test.ts`) and run against the
testcontainers Postgres provided by `test/global-setup.ts` (`inject("databaseUrl")`);
`startTestDatabase()` applies the committed migrations with `prisma migrate deploy`. Use unique
data per test — the container is shared by the whole package run. See `.claude/rules/testing.md`.

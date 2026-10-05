---
name: prisma
description: Use when changing the Prisma schema, writing a migration, regenerating the client, writing raw SQL in a repository, or wiring a test to the testcontainers Postgres.
---

# Prisma 7 in this repo

## Purpose

Keep every schema change safe (expand-contract), reproducible (committed migrations, drift check
in CI) and contained (Prisma only inside `packages/database`). Rules:
`.claude/rules/migrations.md`, `.claude/rules/repositories.md`.

## Where things are

| What                | Where                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Schema (multi-file) | `packages/database/prisma/schema/` (`schema.prisma` + `<module>/*.prisma`) |
| Migrations          | `packages/database/prisma/migrations/`                                     |
| Config (URL, paths) | `packages/database/prisma.config.ts` (loads the root `.env`)               |
| Generated client    | `packages/database/src/generated/prisma/` (git-ignored)                    |
| Client factory      | `packages/database/src/client.ts` (`@prisma/adapter-pg`)                   |
| Repositories        | `packages/database/src/repositories/<name>.repository.ts`                  |
| Utilities           | `packages/database/src/utils/{pagination,errors,transaction}.ts`           |
| Test helpers        | `packages/database/test/index.ts` (`startTestDatabase`)                    |
| Seed                | `packages/database/prisma/seed/` (`yarn db:seed`)                          |

`prisma.config.ts` points `schema` at the **folder** `prisma/schema`. `schema/schema.prisma` holds
only the `generator` and `datasource` blocks; every model has its own file,
`schema/<module>/<model-kebab>.prisma` (one folder per module, one model per file, enums in the
file of the model that owns them): `system/health-check.prisma`,
`auth/{user,session,account,verification}.prisma`, `email/outbox-email.prisma` (`OutboxStatus` +
`OutboxEmail`), `source/{source-region,source-prefecture,source-address}.prisma` (`SourceArea` +
`SourceRegion`, `SourcePrefecture`, `SourceAddress`),
`access/{role,permission,role-permission,user-permission}.prisma` (`Role`, `Permission`,
`RolePermission`, `UserPermission`). Prisma merges the folder; relations across files work as
usual.

## How-to: add or change a model

1. Add the ADR line (`docs/adr/`, see the `adr` skill). A schema change without an ADR line is a
   review BLOCKER.
2. Add `prisma/schema/<module>/<model-kebab>.prisma` (or edit the existing file): PascalCase
   model, `@@map("snake_case")`, `@map` on multi-word columns,
   `id String @id @default(uuid(7)) @db.Uuid`,
   `createdAt DateTime @default(now()) @map("created_at")`. A new module gets a new folder. A pure
   join table instead uses a composite `@@id` over its two foreign keys (ADR 0005).
3. Make it expand-contract safe: new columns nullable or defaulted; constraints only after a
   backfill.
4. `yarn docker:up`, then `yarn db:migrate:dev --name add_<thing>`; read the SQL it generated, then
   `yarn db:generate` (Prisma 7's `migrate dev` no longer regenerates the client).
5. Export the model type from `packages/database/src/index.ts`; add or extend the repository.
6. Write the repository test (`packages/database/test/repositories/<name>.repository.test.ts`)
   against `inject("databaseUrl")`.
7. `yarn verify`. CI additionally runs
   `prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`.

Existing models from `0001_init`: `User`, `Session`, `Account`, `Verification` (Better Auth: field
names fixed, tables/columns mapped to snake_case, plus our `deletedAt`) and `OutboxEmail` with enum
`OutboxStatus` (`PENDING | SENT | FAILED`). Since
`20261005070927_add_source_regions_and_prefectures`: `SourceRegion` (enum `SourceArea`) and
`SourcePrefecture`, related by the natural key `code`
(`docs/adr/0005-legacy-reference-data.md`). Since `20261005081809_add_source_addresses`:
`SourceAddress`, the Japan Post postal-code master, looked up by the unique `postCode`. Since
`20261005090103_add_roles_and_permissions`: the role and permission catalog `Role`, `Permission`,
`RolePermission`, `UserPermission`, keyed by `roles.key` / `permissions.key`; `User` gains only
the relation `permissions`, and `users.role` stays a Better Auth string with no foreign key.
Regenerating the Better Auth models is described in `.claude/rules/migrations.md` (diff the CLI
output against the files under `prisma/schema/auth/`).

## How-to: seed data

`yarn db:seed` (`prisma db seed` → `tsx prisma/seed/index.ts`) is the only seed command. Seeds live
in `packages/database/prisma/seed/`, one `<dataset>.seed.ts` per dataset exporting a `SeedFn` that
returns a `SeedSummary` (`support.ts`); `index.ts` calls them in order, parents before children,
and `runSeeds` prints one line per dataset (permissions add `grants +n/-m` for the role grants
synced to the CSV). Reference datasets are idempotent: a re-run reports `created 0, updated 0`
(`grants +0/-0`) and leaves every `updated_at` unchanged.

`users.seed.ts` upserts two verified accounts by email, so it converges and is safe to re-run (a
re-run re-hashes the password and reports existing accounts as `updated`); the password for both is
`A12345678`, hashed with `hashPassword` from `better-auth/crypto` and stored in a credential
`Account` row so the normal `/api/auth/sign-in/email` flow accepts it: `admin@test.com` (admin) and
`member@test.com` (member). It creates them only when `NODE_ENV` is `development` or `test`; any
other value (unset, `production`, `staging`) skips both and reports them as `skipped`, so
`yarn db:seed` loads reference data in a real environment without creating known-password logins.
Seed a real environment from its own environment, never from a developer checkout whose `.env`
says `development`. Add new fixtures to the `SEED_USERS` array as upserts, never as plain
`create`. A new dataset is a new `<dataset>.seed.ts` called from `index.ts`, with its test in
`packages/database/test/seed/`.

## How-to: write a repository

```ts
// packages/database/src/repositories/outbox-email.repository.ts
export const createOutboxEmailRepository = (db: DbClient) => ({
  create: (data: CreateOutboxEmailData): Promise<OutboxEmail> => db.outboxEmail.create({ data }),

  markSent: (id: string): Promise<OutboxEmail> =>
    db.outboxEmail.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    }),

  findStalePending: (olderThan: Date, limit = 100): Promise<OutboxEmail[]> =>
    db.outboxEmail.findMany({
      where: { status: "PENDING", createdAt: { lt: olderThan } },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),
});
```

`DbClient = PrismaClient | Prisma.TransactionClient`, so the factory works with the client or an
open transaction. One method per transition, no validation, no business rule, no queue. Paginated
lists take a caller-composed `Prisma.<Model>WhereInput` (`createUserRepository(db).findMany(params, where)`)
and add `deletedAt: null` themselves. Export from `packages/database/src/repositories/index.ts`.

## How-to: transactions with after-commit hooks

```ts
// apps/api/src/modules/user/user.service.ts
return withTransaction(ctx.db, async ({ tx }) => {
  const users = createUserRepository(tx);
  const target = await users.findById(input.userId);
  if (target?.role === "admin" && (await users.countActiveAdmins()) <= 1) {
    throw new ConflictError("Cannot demote the last admin");
  }
  return users.updateRole(input.userId, input.role);
});
```

`withTransaction(prisma, callback, options?)` (`packages/database/src/utils/transaction.ts`) runs an
interactive transaction; `afterCommit(hook)` registers work that runs only after the commit (queue
producers — see `queueEmailInTransaction` in `apps/api/src/modules/email/email.service.ts`).
Hooks that throw are collected into an `AfterCommitError` unless `onAfterCommitError` is given.

## How-to: raw SQL

Only in a repository, only as a tagged template:

```ts
const rows = await db.$queryRaw<{ id: string }[]>`
  SELECT id FROM users WHERE role = ${role} AND deleted_at IS NULL
`;
```

Columns Prisma cannot model (PostGIS `geometry`) are declared as
`Unsupported("geometry(Point, 4326)")` in the schema and read/written only through raw queries.
Never `$queryRawUnsafe` with input.

## How-to: use the test database

```ts
import { afterAll, beforeAll, inject } from "vitest";

import { createPrismaClient, type PrismaClient } from "@repo/database";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(() => prisma.$disconnect());
```

The workspace's `test/global-setup.ts` starts the container (`startTestDatabase()` runs
`prisma migrate deploy`) and provides `databaseUrl`. A workspace without that setup copies
`packages/database/test/global-setup.ts` and adds `globalSetup` to its `vitest.config.ts`.

Repository tests (`packages/database/test/repositories/user.repository.test.ts`,
`outbox-email.repository.test.ts`) create their rows with unique values
(`${crypto.randomUUID()}@example.com`) directly through the client, call the repository and assert
on what comes back — for example "excludes soft-deleted users from reads and counts" and "finds
stale PENDING rows only".

## Gotchas

- `prisma.config.ts` deliberately does not use `env("DATABASE_URL")`: `prisma generate` runs on
  `postinstall` without a database. Commands that connect fail loudly on the sentinel host.
- Existing process env wins over `.env` — CI and testcontainers rely on it.
- After pulling a schema change run `yarn db:generate` (or reinstall), or types are stale.
- Prisma 7 requires a driver adapter: never `new PrismaClient()` without one; use
  `createPrismaClient` / `getPrismaClient`.
- The generated client is ESM (`moduleFormat = "esm"`); import model types via `@repo/database`,
  never from `src/generated`.
- Prisma error codes (`P2002`, `P2003`, `P2025`) and Postgres SQLSTATEs (`23505`, `23503`) are
  compared only in `packages/database/src/utils/errors.ts`; elsewhere use
  `translateDatabaseError` / `isUniqueViolation`.
- `prisma migrate reset` is denied for agents; never run it against a shared database.

---
name: prisma
description:
  Use when changing the Prisma schema, writing a migration, regenerating the client, writing raw SQL
  in a repository, or wiring a test to the testcontainers Postgres.
---

# Prisma 7 in this repo

Keep every schema change safe (expand-contract), reproducible (committed migrations, drift check in
CI) and contained (Prisma only inside `packages/database`). Facts live in
`.claude/rules/migrations.md` (schema folders, migrations table, seeds, Better Auth models) and
`.claude/rules/repositories.md` (repository contract); this skill is the how-to.

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

`prisma.config.ts` points `schema` at the **folder** `prisma/schema`: `schema.prisma` holds only the
`generator` and `datasource` blocks, every model has its own file
`schema/<module>/<model-kebab>.prisma` (enums in the file of the model that owns them), and Prisma
merges the folder, so relations across files work as usual.

## How-to: add or change a model

1. Add the ADR line (`docs/adr/`, see the `adr` skill). A schema change without an ADR line is a
   review BLOCKER.
2. Add or edit `prisma/schema/<module>/<model-kebab>.prisma`: PascalCase model,
   `@@map("snake_case")`, `@map` on multi-word columns, `id String @id @default(uuid(7)) @db.Uuid`,
   `createdAt DateTime @default(now()) @map("created_at")`. A new module gets a new folder; a pure
   join table uses a composite `@@id` over its two foreign keys instead of a uuid (ADR 0005).
3. Make it expand-contract safe: new columns nullable or defaulted; constraints only after a
   backfill. Data steps (inserting catalog rows, backfilling) go into the same migration file by
   hand — `migrate dev --create-only`, edit the SQL, then apply.
4. Run `yarn db:migrate:dev --name add_<thing>` against a database you may reset (the compose
   Postgres, or a throwaway container when the shared one has diverged — prefix the command with
   `DATABASE_URL=...`); read the generated SQL, then `yarn db:generate` (Prisma 7's `migrate dev` no
   longer regenerates the client).
5. Export the model type from `packages/database/src/index.ts`; add or extend the repository and its
   test under `packages/database/test/repositories/`.
6. Gate:
   `yarn workspace @repo/database prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`
   prints "No difference detected" (CI runs the same), then `yarn verify`.

Regenerating the Better Auth models and merging our fields back is described in
`.claude/rules/migrations.md` ("Better Auth models").

## How-to: seed data

`yarn db:seed` is the only seed command: `prisma/seed/index.ts` calls one `<dataset>.seed.ts` per
dataset (a `SeedFn` returning a `SeedSummary`, helpers in `support.ts`), parents before children,
and prints one line per dataset. Reference datasets are diff-based upserts, so a re-run reports
zeros and leaves `updated_at` alone; a new dataset is a new file called from `index.ts` with a test
in `packages/database/test/seed/`. The datasets, the CSV rules and the test accounts are listed in
`.claude/rules/migrations.md` (seed section). Seed a real environment from its own environment,
never from a developer checkout.

## How-to: write a repository

Follow `packages/database/src/repositories/user.repository.ts`: a factory
`create<Name>Repository(db: DbClient)` of thin Prisma calls, one method per transition, Prisma types
in and out, `deletedAt: null` added by the read methods, no validation, no business rule, no queue;
export it from `repositories/index.ts` and add the model type to `src/index.ts`. The full contract
is `.claude/rules/repositories.md`.

## How-to: transactions with after-commit hooks

`withTransaction(ctx.db, async ({ tx, afterCommit }) => ...)` (`src/utils/transaction.ts`) runs an
interactive transaction; build repositories on `tx`. `afterCommit(hook)` registers work that runs
only after the commit — queue producers, never inside the transaction body (see
`queueEmailInTransaction` in `apps/api/src/modules/email/email.service.ts`). Hooks that throw are
collected into an `AfterCommitError` unless `onAfterCommitError` is given. A worked example of a
stateful rule inside a transaction is `update` in `apps/api/src/modules/user/user.service.ts` (role
change with the last-admin rule and the permission overrides in one unit of work).

## How-to: raw SQL

Only in a repository, only as a tagged template (`db.$queryRaw<Row[]>\`SELECT ...
${value}\``);
never `$queryRawUnsafe`with input. Columns Prisma cannot model (PostGIS`geometry`) are declared as `Unsupported("...")`
and read/written only through raw queries.

## How-to: use the test database

A workspace's `test/global-setup.ts` calls `startTestDatabase()` (migrations applied with
`prisma migrate deploy`; `{ seedReferenceData: true }` also loads the role and permission catalog)
and provides `databaseUrl`; a test creates its client in `beforeAll` with
`createPrismaClient({ connectionString: inject("databaseUrl") })` and disconnects in `afterAll`.
Copy `packages/database/test/global-setup.ts` into a workspace that has none. Repository tests
create rows with unique values, call the repository and assert on what comes back; the harness
details are in `.claude/rules/testing.md`.

## Gotchas

- `prisma.config.ts` deliberately does not use `env("DATABASE_URL")`: `prisma generate` runs on
  `postinstall` without a database. Commands that connect fail loudly on the sentinel host.
- Existing process env wins over `.env` — CI, testcontainers and a `DATABASE_URL=` prefix rely on
  it.
- After pulling a schema change run `yarn db:generate` (or reinstall), or types are stale.
- Prisma 7 requires a driver adapter: never `new PrismaClient()` without one; use
  `createPrismaClient` / `getPrismaClient`.
- The generated client is ESM (`moduleFormat = "esm"`); import model types via `@repo/database`,
  never from `src/generated`.
- Prisma error codes (`P2002`, `P2003`, `P2025`) and Postgres SQLSTATEs (`23505`, `23503`) are
  compared only in `packages/database/src/utils/errors.ts`; elsewhere use `translateDatabaseError` /
  `isUniqueViolation` / `isForeignKeyViolation`.
- Never edit a migration that has been applied anywhere, even to add a comment: the recorded
  checksum changes and `migrate deploy` refuses it. `prisma migrate reset` is denied for agents.
- Better Auth writes `role` as a plain string; never pass `roleRef: { connect }` together with
  `role` in one Prisma call.

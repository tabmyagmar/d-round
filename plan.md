# Plan: Port legacy reference data into @repo/database (source hierarchy, postal addresses, role/permission catalog)

> **Amendment 2026-10-05 (user decision):** one seed command only. `yarn db:seed` (`prisma/seed/index.ts`) calls every dataset seed in order and then the test accounts, which `seedUsers` creates only when `NODE_ENV` is `development` or `test` (fail closed; any other value skips them). `reference.ts`, `reference-data.ts` (`REFERENCE_SEEDS`), `db:seed:reference` and the `database/seed-production-safe` lint rule were removed after A1. Where units B and C below said "register in `reference-data.ts`", call the seed from `index.ts` instead; smoke with `yarn db:seed`.

## Goal and acceptance criteria

Add the first legacy d-round domain data to `@repo/database`: `SourceRegion`/`SourcePrefecture` (Japan regions and prefectures), `SourceAddress` (Japan Post postal-code master), and `Role`/`Permission` with `RolePermission`/`UserPermission` join tables that sit next to Better Auth's `User`, each with an idempotent CSV-driven seed. One command, `yarn db:seed`, loads every reference dataset and then the two test accounts, which are created only when `NODE_ENV` is `development` or `test` (see the amendment above). Delivered as four MR-sized units in order: A0 seed folder refactor, A1 regions/prefectures, B addresses, C roles/permissions.

- `yarn db:migrate:dev` produces three new migrations after `0001_init` (`add_source_regions_and_prefectures`, `add_source_addresses`, `add_roles_and_permissions`); CI drift check (`prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`) stays green after each unit.
- `yarn db:seed` (`tsx prisma/seed/index.ts`) loads every reference dataset, then the test users `admin@test.com` / `member@test.com` (password `A12345678`); with any `NODE_ENV` other than `development` or `test` (unset, `production`, `staging`) it loads the reference data and skips the test users. Reference datasets are idempotent: a second run changes nothing (row counts and `updated_at` values identical).
- Seeds are covered by testcontainers tests in `packages/database/test/seed/`: counts (9 regions, 47 prefectures, 120,663 addresses, 4 roles, 42 permissions, 86 role grants), FK integrity, legacy-parity spot checks, idempotency (`updated_at` unchanged on re-run).
- Model types (`SourceRegion`, `SourcePrefecture`, `SourceAddress`, `Role`, `Permission`, `RolePermission`, `UserPermission`) and the `SourceArea` enum are exported from `packages/database/src/index.ts`.
- Every schema change is recorded in new `docs/adr/0005-legacy-reference-data.md` (created in A1, dated lines under `## Changes` in B and C) and follows `.claude/rules/migrations.md` (uuid v7 ids, snake_case maps, `created_at`, explicit `onDelete`, indexed FKs).
- `yarn verify` green at the end of every step.

## Files to touch (max 15)

Four MR units; each table is ≤ 15 files. "Layer" uses the element names of `.claude/rules/layers.md` (`database` = packages/database outside repositories; `docs`/`root` for non-code).

### Unit A0 — seed folder refactor (14 files, no schema change)

| #   | File                                            | Action | Layer    | Purpose                                                                                                                                                                            |
| --- | ----------------------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | packages/database/prisma/seed.ts                | delete | database | Replaced by the `prisma/seed/` folder                                                                                                                                              |
| 2   | packages/database/prisma/seed/support.ts        | create | database | `SeedFn`/`SeedSummary` types, `runSeeds` (root `.env` via dotenv, `DATABASE_URL` guard, `createPrismaClient`, sequential run, summary lines, `$disconnect`), `assertNotProduction` |
| 3   | packages/database/prisma/seed/users.seed.ts     | create | database | `SEED_PASSWORD`, `SEED_USERS`, `seedUsers: SeedFn` moved verbatim from seed.ts (behaviour unchanged)                                                                               |
| 4   | packages/database/prisma/seed/reference-data.ts | create | database | `REFERENCE_SEEDS` registry (empty in A0) + `seedReferenceData(prisma)` running it in order                                                                                         |
| 5   | packages/database/prisma/seed/reference.ts      | create | database | Production-safe entrypoint: `await runSeeds("reference", seedReferenceData)`; never imports users.seed                                                                             |
| 6   | packages/database/prisma/seed/index.ts          | create | database | Dev entrypoint: `assertNotProduction(process.env)`, then reference data, then `seedUsers`                                                                                          |
| 7   | packages/database/prisma.config.ts              | modify | database | `seed: "tsx prisma/seed/index.ts"`                                                                                                                                                 |
| 8   | packages/database/package.json                  | modify | database | script `"db:seed:reference": "tsx prisma/seed/reference.ts"`                                                                                                                       |
| 9   | package.json                                    | modify | root     | script `"db:seed:reference": "yarn workspace @repo/database db:seed:reference"`                                                                                                    |
| 10  | packages/database/eslint.config.mjs             | modify | database | `no-restricted-imports` for `prisma/seed/**` except `index.ts`/`users.seed.ts`: forbid `./users.seed` and `better-auth*`                                                           |
| 11  | packages/database/test/seed/users.seed.test.ts  | create | test     | Behaviour of the test-user seed (first test coverage it gets)                                                                                                                      |
| 12  | packages/database/test/seed/support.test.ts     | create | test     | `assertNotProduction` behaviour                                                                                                                                                    |
| 13  | .claude/rules/migrations.md                     | modify | docs     | Seed section: `prisma/seed/` layout, `db:seed` vs `db:seed:reference`                                                                                                              |
| 14  | README.md                                       | modify | docs     | `db:seed` row + new `db:seed:reference` row (lines 33–34, 61–62, 140)                                                                                                              |

### Unit A1 — SourceRegion / SourcePrefecture (15 files)

| #   | File                                                                                      | Action | Layer    | Purpose                                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | docs/adr/0005-legacy-reference-data.md                                                    | create | docs     | ADR for the whole port; A1 decision lines written first                                                              |
| 2   | packages/database/prisma/schema/source/source-region.prisma                               | create | database | `enum SourceArea` (`source_area`) + `SourceRegion` (`source_regions`)                                                |
| 3   | packages/database/prisma/schema/source/source-prefecture.prisma                           | create | database | `SourcePrefecture` (`source_prefectures`), FK `region_code → source_regions.code`                                    |
| 4   | packages/database/prisma/migrations/<ts>_add_source_regions_and_prefectures/migration.sql | create | database | Generated by `migrate dev`; read before commit                                                                       |
| 5   | packages/database/src/index.ts                                                            | modify | database | export `SourceArea` value, types `SourceRegion`, `SourcePrefecture`                                                  |
| 6   | packages/database/package.json                                                            | modify | database | devDependency `csv-parse` `7.0.3`                                                                                    |
| 7   | yarn.lock                                                                                 | modify | root     | lockfile for csv-parse                                                                                               |
| 8   | packages/database/prisma/seed/support.ts                                                  | modify | database | add `readCsv<T>(url)` (csv-parse sync, `columns: true`, `bom: true`) and `diffByKey`                                 |
| 9   | packages/database/prisma/seed/data/source-regions.csv                                     | create | database | Legacy `sourceRegion.csv`, CRLF normalized to LF + final newline (header `code,name,nameEn,area`, 9 rows)            |
| 10  | packages/database/prisma/seed/data/source-prefectures.csv                                 | create | database | Legacy `sourcePrefecture.csv`, CRLF normalized to LF + final newline (header `code,name,nameEn,regionCode`, 47 rows) |
| 11  | packages/database/prisma/seed/source-regions.seed.ts                                      | create | database | `seedSourceRegions: SeedFn` (diff-based upsert by `code`)                                                            |
| 12  | packages/database/prisma/seed/source-prefectures.seed.ts                                  | create | database | `seedSourcePrefectures: SeedFn` (diff-based upsert by `code`, scalar `regionCode`)                                   |
| 13  | packages/database/prisma/seed/reference-data.ts                                           | modify | database | register `[seedSourceRegions, seedSourcePrefectures]`                                                                |
| 14  | packages/database/test/seed/source-regions.seed.test.ts                                   | create | test     | counts, areas, idempotency                                                                                           |
| 15  | packages/database/test/seed/source-prefectures.seed.test.ts                               | create | test     | counts, FK integrity, per-region distribution, idempotency                                                           |

### Unit B — SourceAddress (10 files)

| #   | File                                                                        | Action | Layer    | Purpose                                                                                                              |
| --- | --------------------------------------------------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | docs/adr/0005-legacy-reference-data.md                                      | modify | docs     | dated line under `## Changes` for `source_addresses`                                                                 |
| 2   | packages/database/prisma/schema/source/source-address.prisma                | create | database | `SourceAddress` (`source_addresses`), `postCode @unique`, 4 Boolean flags                                            |
| 3   | packages/database/prisma/migrations/<ts>_add_source_addresses/migration.sql | create | database | Generated; read before commit                                                                                        |
| 4   | packages/database/src/index.ts                                              | modify | database | export type `SourceAddress`                                                                                          |
| 5   | packages/database/prisma/seed/support.ts                                    | modify | database | `readCsv` gunzips `*.gz` (node:zlib `gunzipSync`); add `chunk<T>(items, size)`                                       |
| 6   | packages/database/prisma/seed/data/source-addresses.csv.gz                  | create | database | `gzip -9 -n` of legacy `sourceAddress.csv` (2.4 MB, 124,809 rows, legacy header incl. `id`)                          |
| 7   | packages/database/prisma/seed/source-addresses.seed.ts                      | create | database | `seedSourceAddresses: SeedFn`: dedup by `postCode` (first wins), `createMany({ skipDuplicates })` in chunks of 1,000 |
| 8   | packages/database/prisma/seed/index.ts                                      | modify | database | call `seedSourceAddresses` after the prefectures (slowest dataset)                                                   |
| 9   | packages/database/test/seed/source-addresses.seed.test.ts                   | create | test     | 120,663 rows, flag/int conversion, first-wins duplicates, idempotency (120 s timeout)                                |
| 10  | packages/database/test/seed/support.test.ts                                 | modify | test     | `readCsv` reads a `.gz` file; `chunk` splits into even slices                                                        |

### Unit C — Role / Permission (14 files)

| #   | File                                                                             | Action | Layer    | Purpose                                                                                                            |
| --- | -------------------------------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | docs/adr/0005-legacy-reference-data.md                                           | modify | docs     | dated line under `## Changes` for the access catalog + the uuid/natural-key exceptions                             |
| 2   | packages/database/prisma/schema/access/role.prisma                               | create | database | `Role` (`roles`), `key @unique`                                                                                    |
| 3   | packages/database/prisma/schema/access/permission.prisma                         | create | database | `Permission` (`permissions`), self-relation on `key`, `@@unique([action, subject])`                                |
| 4   | packages/database/prisma/schema/access/role-permission.prisma                    | create | database | `RolePermission` (`role_permissions`), `@@id([roleKey, permissionKey])`                                            |
| 5   | packages/database/prisma/schema/access/user-permission.prisma                    | create | database | `UserPermission` (`user_permissions`), `@@id([userId, permissionKey])`, `userId → users.id Cascade`                |
| 6   | packages/database/prisma/schema/auth/user.prisma                                 | modify | database | add relation field `permissions UserPermission[]` only (no column, Better Auth fields untouched)                   |
| 7   | packages/database/prisma/migrations/<ts>_add_roles_and_permissions/migration.sql | create | database | Generated; read before commit                                                                                      |
| 8   | packages/database/src/index.ts                                                   | modify | database | export types `Role`, `Permission`, `RolePermission`, `UserPermission`                                              |
| 9   | packages/database/prisma/seed/roles.seed.ts                                      | create | database | `ROLE_SEEDS` const (`super_admin`, `admin`, `manager`, `staff` + name/nameJp), `RoleKey` type, `seedRoles: SeedFn` |
| 10  | packages/database/prisma/seed/data/permissions.csv                               | create | database | Legacy `permissions.csv`; header role columns renamed to `super_admin,admin,manager,staff` (values unchanged)      |
| 11  | packages/database/prisma/seed/permissions.seed.ts                                | create | database | `seedPermissions: SeedFn`: parents then children, diff-based upsert; role grants synced to the CSV                 |
| 12  | packages/database/prisma/seed/index.ts                                           | modify | database | call `seedRoles`, `seedPermissions` before the source datasets                                                     |
| 13  | packages/database/test/seed/roles.seed.test.ts                                   | create | test     | 4 roles, keys, idempotency                                                                                         |
| 14  | packages/database/test/seed/permissions.seed.test.ts                             | create | test     | 42 permissions, parent links, 86 grants per CSV, sync semantics, user grants untouched, idempotency                |

Docs to refresh at Close for A1/B/C (protocol Step 6, orchestrator; not counted above): `.claude/rules/migrations.md` ("Existing migrations" table rows, multi-file layout list gains `source/` and `access/`, note that `User` gains a `permissions` relation), `.claude/skills/prisma/SKILL.md` lines 26 and 52–65 (seed path, existing models, `db:seed:reference`), `.claude/agents/verifier.md` line 44 (already says `prisma/schema.prisma`; should be `prisma/schema`).

## Schema changes

FLAG — three additive expand-stage migrations (new tables and one enum; no column changes to existing tables; `User.permissions` is a relation field without a column). No backfill/constrain/contract stages are needed. ADR: new `docs/adr/0005-legacy-reference-data.md`.

A1 — `yarn db:migrate:dev --name add_source_regions_and_prefectures` (ADR 0005 Decision):

```prisma
// prisma/schema/source/source-region.prisma
enum SourceArea {
  EAST
  WEST

  @@map("source_area")
}

model SourceRegion {
  id        String     @id @default(uuid(7)) @db.Uuid
  code      Int        @unique
  name      String
  nameEn    String     @map("name_en")
  area      SourceArea
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  prefectures SourcePrefecture[]

  @@map("source_regions")
}

// prisma/schema/source/source-prefecture.prisma
model SourcePrefecture {
  id         String       @id @default(uuid(7)) @db.Uuid
  code       Int          @unique
  name       String
  nameEn     String       @map("name_en")
  regionCode Int          @map("region_code")
  region     SourceRegion @relation(fields: [regionCode], references: [code], onDelete: Restrict)
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")

  @@index([regionCode])
  @@map("source_prefectures")
}
```

B — `yarn db:migrate:dev --name add_source_addresses` (ADR 0005 `## Changes` line):

```prisma
// prisma/schema/source/source-address.prisma
model SourceAddress {
  id          String  @id @default(uuid(7)) @db.Uuid
  jisCode     Int     @map("jis_code")
  oldPostCode String? @map("old_post_code")
  postCode    String  @unique @map("post_code")
  prefKana    String? @map("pref_kana")
  cityKana    String? @map("city_kana")
  townKana    String? @map("town_kana")
  pref        String
  city        String
  town        String
  isTownRepresentedByMultiplePostalCodes Boolean @default(false) @map("is_town_represented_by_multiple_postal_codes")
  isHamletNumberingStart                 Boolean @default(false) @map("is_hamlet_numbering_start")
  hasChome                               Boolean @default(false) @map("has_chome")
  isPostalCodeForMultipleTownAreas       Boolean @default(false) @map("is_postal_code_for_multiple_town_areas")
  updateStatus Int      @default(0) @map("update_status")
  changeReason Int      @default(0) @map("change_reason")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("source_addresses")
}
```

(The legacy extra `@@index([postCode])` is dropped: `@unique` already creates the index.)

C — `yarn db:migrate:dev --name add_roles_and_permissions` (ADR 0005 `## Changes` line recording the exceptions: natural keys `roles.key` / `permissions.key` as relation targets, composite `@@id` join tables without uuid, no FK `users.role → roles.key`):

```prisma
// prisma/schema/access/role.prisma
model Role {
  id        String   @id @default(uuid(7)) @db.Uuid
  key       String   @unique
  name      String
  nameJp    String   @map("name_jp")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  permissions RolePermission[]

  @@map("roles")
}

// prisma/schema/access/permission.prisma
model Permission {
  id        String       @id @default(uuid(7)) @db.Uuid
  key       String       @unique
  name      String
  nameJp    String       @map("name_jp")
  parentKey String?      @map("parent_key")
  parent    Permission?  @relation("PermissionParent", fields: [parentKey], references: [key], onDelete: Restrict)
  children  Permission[] @relation("PermissionParent")
  action    String
  subject   String
  modelName String       @map("model_name")
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  roles RolePermission[]
  users UserPermission[]

  @@unique([action, subject])
  @@index([parentKey])
  @@map("permissions")
}

// prisma/schema/access/role-permission.prisma
model RolePermission {
  roleKey       String     @map("role_key")
  permissionKey String     @map("permission_key")
  role          Role       @relation(fields: [roleKey], references: [key], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionKey], references: [key], onDelete: Cascade)
  createdAt     DateTime   @default(now()) @map("created_at")
  assignedBy    String?    @map("assigned_by") @db.Uuid

  @@id([roleKey, permissionKey])
  @@index([permissionKey])
  @@map("role_permissions")
}

// prisma/schema/access/user-permission.prisma
model UserPermission {
  userId        String     @map("user_id") @db.Uuid
  permissionKey String     @map("permission_key")
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permissionKey], references: [key], onDelete: Cascade)
  createdAt     DateTime   @default(now()) @map("created_at")
  assignedBy    String?    @map("assigned_by") @db.Uuid

  @@id([userId, permissionKey])
  @@index([permissionKey])
  @@map("user_permissions")
}
```

`auth/user.prisma`: add `permissions UserPermission[]` next to `sessions`/`accounts`; nothing else.

Expected generated SQL (check before committing): `CREATE TYPE "source_area"`, `CREATE TABLE` with `"id" UUID NOT NULL`, `CREATE UNIQUE INDEX "source_regions_code_key"`, FKs `ON DELETE RESTRICT ON UPDATE CASCADE` (prefecture→region, permission→parent) and `ON DELETE CASCADE ON UPDATE CASCADE` (join tables), `CREATE UNIQUE INDEX "permissions_action_subject_key"`. No `ALTER TABLE "users"` statements in C.

## Tests to add or update

All tests use `createPrismaClient({ connectionString: inject("databaseUrl") })` in `beforeAll` (pattern of `packages/database/test/repositories/user.repository.test.ts`) against the shared testcontainers Postgres; the seed modules are imported from `../../prisma/seed/<name>`. Every `createMany` in the seeds uses `skipDuplicates: true`, so the test files may run in parallel on one database.

| Test file                                                        | Kind        | Asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/database/test/seed/support.test.ts (A0)                 | unit        | Superseded by the amendment: `readCsv` (BOM, CRLF, padding; header must match the expected columns), `parseInteger` (rejects `""`, `1.5`, `12a`), `diffByKey` (create/update split; throws on a repeated key)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| packages/database/test/seed/users.seed.test.ts (A0)              | integration | after `seedUsers(prisma)`: both `SEED_USERS` exist, `emailVerified` true, role as configured, exactly one `Account` with `providerId "credential"` whose `password` passes `verifyPassword({ hash, password: SEED_PASSWORD })` from `better-auth/crypto`; re-run after `prisma.user.update({ deletedAt: new Date(), banned: true })` on `admin@test.com` restores `deletedAt null`/`banned false` and still leaves exactly one credential account; summary `dataset "users"`, `rows 2`                                                                                                                                                                                                                     |
| packages/database/test/seed/source-regions.seed.test.ts (A1)     | integration | 9 rows, codes 1–9, `area EAST` for 1–4 and `WEST` for 5–9, code 1 = 北海道 / Hokkaido; second run: count 9, every row's `updatedAt` unchanged, summary `created 0, updated 0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| packages/database/test/seed/source-prefectures.seed.test.ts (A1) | integration | after `seedSourceRegions` + `seedSourcePrefectures`: 47 rows; `findMany({ include: { region: true } })` has no null region; per-region counts `{1:1, 2:6, 3:4, 4:3, 5:4, 6:6, 7:6, 8:8, 9:9}`; code 13 = 東京都 in region 4; second run: `updatedAt` unchanged, summary zeros                                                                                                                                                                                                                                                                                                                                                                                                                              |
| packages/database/test/seed/source-addresses.seed.test.ts (B)    | integration | `count()` = 120,663; summary `rows 120_663`, `skipped 4_146`; `0600000` → pref 北海道, city 札幌市中央区, all four flags false, `updateStatus 0`, `changeReason 0`; `0640941` → `hasChome true`; first occurrence wins: `0040000` → city 札幌市厚別区 (not 札幌市清田区) and `0680546` → town 南部青葉町 (not 南部菊水町), both `isPostalCodeForMultipleTownAreas true`; second run: count unchanged, summary `created 0`, `updatedAt` of `0600000` unchanged. Per-test timeout 120_000 ms on the load tests                                                                                                                                                                                               |
| packages/database/test/seed/support.test.ts (B)                  | unit        | `readCsv` on a gzip-compressed CSV returns the same rows as the plain file; `chunk([1..5], 2)` is `[[1,2],[3,4],[5]]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| packages/database/test/seed/roles.seed.test.ts (C)               | integration | 4 rows with keys exactly `super_admin, admin, manager, staff`; `super_admin.nameJp` = スーパーアドミン; second run: `updatedAt` unchanged, summary zeros                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| packages/database/test/seed/permissions.seed.test.ts (C)         | integration | after `seedRoles` + `seedPermissions`: 42 permissions; 8 parents (`parentKey null`, `action "all"`); 34 children each with a resolvable `parent`; `"1101".parentKey === "1100"`; `roleName`-free: `rolePermission.count()` = 86, per role super_admin 34 / admin 34 / manager 10 / staff 8; `"1202"` granted to all four, `"1101"` to super_admin+admin only, `"1100"` to none, `"1401"` to super_admin/admin/manager not staff; a manually inserted stale grant `(staff, "1101")` is removed by the next run; a `UserPermission` for a fresh random user on `"1202"` survives the run (seed never touches user grants); second run: permission `updatedAt` and grant `createdAt` unchanged, summary zeros |

## Steps (executed in order, one at a time)

Conventions for every step: Conventional Commit per unit (`refactor(database): …` for A0, `feat(database): …` for A1/B/C with `Refs: docs/adr/0005-legacy-reference-data.md` in the migration commit). Shell for migrations: `yarn docker:up` first (compose Postgres on host port 5433, Redis 6380, URL from root `.env`); if `node` is missing in a non-interactive shell, `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`. Never `migrate reset`.

### Unit A0 — seed folder refactor (no schema change)

### Step 1 — Move the test-user seed into `prisma/seed/` with a shared support module

- Files: `packages/database/prisma/seed/support.ts`, `packages/database/prisma/seed/users.seed.ts`, `packages/database/test/seed/support.test.ts`, `packages/database/test/seed/users.seed.test.ts` (seed.ts is deleted in Step 2 so lint stays green between steps).
- Test first: `support.test.ts` for `assertNotProduction`; `users.seed.test.ts` as listed above (imports `seedUsers`, `SEED_USERS`, `SEED_PASSWORD` from `../../prisma/seed/users.seed`, `verifyPassword` from `better-auth/crypto`).
- Then implement: `support.ts` exports `type SeedSummary = { dataset: string; rows: number; created: number; updated: number; skipped: number }`, `type SeedFn = (prisma: PrismaClient) => Promise<SeedSummary>` (`import type { PrismaClient } from "../../src/client"`), `assertNotProduction = (env: NodeJS.ProcessEnv): void`, and `runSeeds = async (label: string, run: (prisma: PrismaClient) => Promise<readonly SeedSummary[]>): Promise<void>` which loads the root `.env` with `loadEnv({ path: new URL("../../../../.env", import.meta.url), quiet: true })` (process env wins, same as prisma.config.ts), throws when `DATABASE_URL` is unset, builds the client with `createPrismaClient`, runs `run`, writes one `process.stdout.write` line per summary (`no-console` is an error), disconnects in `finally`. `users.seed.ts` moves `SEED_PASSWORD`, `SEED_USERS`, the credential-account logic verbatim from `prisma/seed.ts` and returns a `SeedSummary` (`created` = users that did not exist before the upsert).
- Check: `yarn workspace @repo/database vitest run test/seed`, `yarn lint`, `yarn typecheck`.

### Step 2 — Entry points, scripts and the production-safety lint rule

- Files: delete `packages/database/prisma/seed.ts`; create `prisma/seed/reference-data.ts`, `prisma/seed/reference.ts`, `prisma/seed/index.ts`; modify `packages/database/prisma.config.ts`, `packages/database/package.json`, root `package.json`, `packages/database/eslint.config.mjs`.
- Test first: none beyond Step 1 (entrypoints are glue; the lint rule is verified by provoking it).
- Then implement: `reference-data.ts` exports `REFERENCE_SEEDS: readonly SeedFn[] = []` and `seedReferenceData = async (prisma) => { const out = []; for (const seed of REFERENCE_SEEDS) out.push(await seed(prisma)); return out; }`. `reference.ts`: `await runSeeds("reference", seedReferenceData)`. `index.ts`: `assertNotProduction(process.env)` then `await runSeeds("dev", async (prisma) => [...(await seedReferenceData(prisma)), await seedUsers(prisma)])` and keep the header comment listing the two accounts. `prisma.config.ts` seed → `tsx prisma/seed/index.ts`. Scripts: package `db:seed:reference` = `tsx prisma/seed/reference.ts`; root `db:seed:reference` = `yarn workspace @repo/database db:seed:reference`. ESLint: add a config object `{ name: "database/seed-production-safe", files: ["prisma/seed/**/*.ts"], ignores: ["prisma/seed/index.ts", "prisma/seed/users.seed.ts"], rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["./users.seed", "**/users.seed", "better-auth", "better-auth/*"], message: "Only prisma/seed/index.ts may seed test users; reference seeds must stay production-safe." }] }] } }`.
- Check: temporarily add `import "./users.seed";` to `reference-data.ts` → `yarn workspace @repo/database lint` must fail, then revert; `yarn lint`, `yarn typecheck`, `yarn workspace @repo/database test`; smoke against docker: `yarn db:seed` prints the users summary, `yarn db:seed:reference` prints zero dataset lines and creates no users (verifier).

### Step 3 — Docs for the new seed layout

- Files: `.claude/rules/migrations.md` (lines 13 and 23–32: `prisma/seed/index.ts` dev entrypoint, `prisma/seed/reference.ts` production-safe entrypoint, `db:seed:reference`, "Never run `db:seed` against production data; `db:seed:reference` is the production seed"), `README.md` (lines 33–34, 61–62, 140 + a `yarn db:seed:reference` row).
- Test first: n/a.
- Then implement: text only.
- Check: `yarn format:check`, `yarn verify`. Commit unit A0.

### Unit A1 — SourceRegion and SourcePrefecture

### Step 4 — ADR, schema, migration, exports

- Files: `docs/adr/0005-legacy-reference-data.md`, `prisma/schema/source/source-region.prisma`, `prisma/schema/source/source-prefecture.prisma`, generated `prisma/migrations/<ts>_add_source_regions_and_prefectures/migration.sql`, `packages/database/src/index.ts`.
- Test first: the existing `test/integration.test.ts` and repository tests are the regression net (they apply the new migration via `startTestDatabase`).
- Then implement: write the ADR first (adr skill template, Date 2026-10-05, Status accepted): Context = porting legacy d-round reference data whose CSVs and schema reference natural codes/keys; Decision = tables above, uuid v7 ids plus natural-key `code Int @unique` as the relation target because the CSVs and legacy data reference codes, `onDelete: Restrict` on prefecture→region (reference data is never deleted implicitly), `enum SourceArea` mapped `source_area`, seeds split into dev (`index.ts`) and production-safe (`reference.ts`) entrypoints with the lint guard, diff-based seeds so a re-run changes nothing, `csv-parse` 7.0.3 as dev dependency for all CSV seeds; Alternatives = autoincrement Int ids (legacy; rejected for the uuid convention), referencing uuid ids from child tables (rejected: CSVs carry codes), one combined seed file (rejected: test users must be physically separate from production data); Consequences = reference tables carry both `id` and `code`; a master refresh is a seed re-run. Then the two schema files exactly as in "Schema changes", `yarn docker:up`, `yarn db:migrate:dev --name add_source_regions_and_prefectures`, read the SQL, add `SourceArea` to the value export line and the two types to `packages/database/src/index.ts`.
- Check: in `packages/database`: `yarn prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` (exit 0), `yarn workspace @repo/database test`, `yarn lint`, `yarn typecheck`.

### Step 5 — CSV reader, diff helper and the regions seed

- Files: `packages/database/package.json` + `yarn.lock` (`yarn workspace @repo/database add -D csv-parse@7.0.3` after re-checking `npm view csv-parse version`), `prisma/seed/support.ts`, `prisma/seed/data/source-regions.csv`, `prisma/seed/source-regions.seed.ts`, `prisma/seed/reference-data.ts`, `test/seed/source-regions.seed.test.ts`.
- Test first: `source-regions.seed.test.ts` as listed.
- Then implement: copy legacy `seed/data/sourceRegion.csv` to `data/source-regions.csv`, normalizing CRLF to LF and adding the missing final newline (`tr -d "\r"`; values unchanged). `support.ts`: `readCsv = <T extends Record<string, string>>(file: URL): T[] => parse(readFileSync(file), { columns: true, skip_empty_lines: true, bom: true, trim: true }) as T[]` (`import { parse } from "csv-parse/sync"`), and `diffByKey = <T>(existing: readonly T[], desired: readonly T[], keyOf: (row: T) => string | number, isSame: (a: T, b: T) => boolean): { toCreate: T[]; toUpdate: T[] }`. `source-regions.seed.ts`: read `new URL("./data/source-regions.csv", import.meta.url)`, map `code: Number.parseInt(code, 10)` (throw on NaN), `area` validated against `SourceArea` values (throw otherwise), load existing with `findMany`, `createMany({ data: toCreate, skipDuplicates: true })`, `update({ where: { code } })` for changed rows only, return `{ dataset: "source_regions", rows: 9, created, updated, skipped: 0 }`. Register in `REFERENCE_SEEDS`.
- Check: `yarn workspace @repo/database vitest run test/seed/source-regions.seed.test.ts`, `yarn lint`, `yarn typecheck`.

### Step 6 — Prefectures seed

- Files: `prisma/seed/data/source-prefectures.csv`, `prisma/seed/source-prefectures.seed.ts`, `prisma/seed/reference-data.ts`, `test/seed/source-prefectures.seed.test.ts`.
- Test first: `source-prefectures.seed.test.ts` as listed (it calls `seedSourceRegions` then `seedSourcePrefectures`).
- Then implement: copy legacy `sourcePrefecture.csv` with the same CRLF→LF + final-newline normalization; seed mirrors Step 5 with the scalar `regionCode` (no nested `connect`, so Prisma can use native upserts and the FK enforces integrity), dataset `"source_prefectures"`. Register after regions.
- Check: `yarn workspace @repo/database test`, `yarn lint`, `yarn typecheck`, `yarn format:check`; smoke `yarn db:seed:reference` twice (second run prints `created 0 updated 0`). Commit unit A1 (`feat(database): add source regions and prefectures with reference seed`).

### Unit B — SourceAddress

### Step 7 — ADR line, schema, migration, export

- Files: `docs/adr/0005-legacy-reference-data.md`, `prisma/schema/source/source-address.prisma`, generated `prisma/migrations/<ts>_add_source_addresses/migration.sql`, `packages/database/src/index.ts`.
- Test first: existing suite as regression net.
- Then implement: ADR `## Changes` line dated 2026-10-05: `source_addresses` = Japan Post master, `post_code` unique as the lookup/relation key (legacy `StaffAddress.postCode → SourceAddress.postCode`), four 0/1 flags become Boolean, `update_status`/`change_reason` stay Int codes, seed is insert-only (`createMany skipDuplicates`, first CSV occurrence wins = legacy MySQL `LOAD DATA LOCAL` behaviour, 124,809 rows → 120,663), data stored gzip-compressed, a master refresh is a separate ticket. Then the model, `yarn db:migrate:dev --name add_source_addresses`, read the SQL, export the type.
- Check: drift diff exit 0, `yarn workspace @repo/database test`, `yarn lint`, `yarn typecheck`.

### Step 8 — Compressed data file and the address seed

- Files: `prisma/seed/data/source-addresses.csv.gz`, `prisma/seed/support.ts`, `prisma/seed/source-addresses.seed.ts`, `prisma/seed/index.ts`, `test/seed/source-addresses.seed.test.ts`, `test/seed/support.test.ts`.
- Test first: `source-addresses.seed.test.ts` as listed, `120_000` ms timeout on the load tests.
- Then implement: `gzip -9 -n -c <legacy>/seed/data/sourceAddress.csv > packages/database/prisma/seed/data/source-addresses.csv.gz` (`-n` = reproducible bytes). `support.ts`: `readCsv` gunzips when `file.pathname.endsWith(".gz")` (`gunzipSync` from `node:zlib`); add `chunk`. Seed: parse rows (ignore the legacy `id` column), map `"1"/"0"` → boolean (throw on anything else), ints via `Number.parseInt` (throw on NaN), `""` → `null` for the four optional string columns, dedup with a `Set` of seen `postCode` keeping the first occurrence, `createMany({ data, skipDuplicates: true })` per chunk of 1,000 (≈18 bind parameters per row, well under Postgres's 65,535 limit; no transaction across chunks so a crash is resumable), summary `{ dataset: "source_addresses", rows: distinct, created: sum of counts, updated: 0, skipped: duplicates }`. Call it from `index.ts` after the prefectures.
- Check: `yarn workspace @repo/database vitest run test/seed/source-addresses.seed.test.ts` (note wall time; target ≤ 15 s), `yarn lint`, `yarn typecheck`.

### Step 9 — Verify and smoke

- Files: none.
- Check: `yarn verify`; smoke `yarn db:seed` twice (second run: reference datasets `created 0, updated 0`). Commit unit B (`feat(database): add the Japan postal-code master with an insert-only seed`).

### Unit C — Role and Permission catalog

### Step 10 — ADR line, schema, migration, exports

- Files: `docs/adr/0005-legacy-reference-data.md`, the four `prisma/schema/access/*.prisma`, `prisma/schema/auth/user.prisma`, generated `prisma/migrations/<ts>_add_roles_and_permissions/migration.sql`, `packages/database/src/index.ts`.
- Test first: existing suite (Better Auth-facing tests in `apps/api` must stay green: `yarn workspace @repo/api test`).
- Then implement: ADR `## Changes` line dated 2026-10-05 recording: new `access/` schema folder (our authorization catalog; `auth/` stays Better-Auth-owned); `roles.key` lower-case to match how Better Auth stores `users.role`; exceptions to the uuid rule (join tables use composite `@@id`; relations target the natural keys `roles.key`/`permissions.key` because the CSV and future legacy data migrations carry keys); no FK from `users.role` to `roles.key` because Better Auth owns that column and its allowed set stays `roleSchema` (ADR 0002) — `member`, Better Auth's default, has no catalog row until the role-set ticket; parent self-relation `onDelete: Restrict` (deleting a menu group must be deliberate, never silently flattening children); `assigned_by` kept as a plain uuid column without FK (audit value, seeds write null); join tables use `created_at` per the repo rule instead of legacy `assignedAt`; the seed syncs role grants to the CSV, never touches `user_permissions`, never deletes permissions. Then the schema files, `user.prisma` relation field, `yarn db:migrate:dev --name add_roles_and_permissions`, read the SQL (no `ALTER TABLE "users"`), export the four types.
- Check: drift diff exit 0, `yarn workspace @repo/database test`, `yarn workspace @repo/api test`, `yarn lint`, `yarn typecheck`.

### Step 11 — Roles seed

- Files: `prisma/seed/roles.seed.ts`, `prisma/seed/index.ts`, `test/seed/roles.seed.test.ts`.
- Test first: `roles.seed.test.ts` as listed.
- Then implement: `export const ROLE_SEEDS = [{ key: "super_admin", name: "Super admin", nameJp: "スーパーアドミン" }, { key: "admin", name: "Admin", nameJp: "アドミン" }, { key: "manager", name: "Manager", nameJp: "マネジャー" }, { key: "staff", name: "Staff", nameJp: "スタッフ" }] as const; export type RoleKey = (typeof ROLE_SEEDS)[number]["key"];` and `seedRoles: SeedFn` (diff-based by `key`, dataset `"roles"`). Call it first in `index.ts`.
- Check: `yarn workspace @repo/database vitest run test/seed/roles.seed.test.ts`, `yarn lint`, `yarn typecheck`.

### Step 12 — Permissions seed with role-grant sync

- Files: `prisma/seed/data/permissions.csv`, `prisma/seed/permissions.seed.ts`, `prisma/seed/index.ts`, `test/seed/permissions.seed.test.ts`.
- Test first: `permissions.seed.test.ts` as listed.
- Then implement: copy legacy `permissions.csv` (CRLF→LF + final newline), change only the header to `key,name,nameJp,parentKey,action,subject,modelName,super_admin,admin,manager,staff`. Seed: `readCsv<PermissionRow>`; validate that every `ROLE_SEEDS` key is a column (throw otherwise); split rows into parents (`parentKey === ""` → `null`) and children; inside `prisma.$transaction(async (tx) => …)`: diff-based upsert of parents then children by `key` (compare name, nameJp, parentKey, action, subject, modelName); build the desired grant set `{ roleKey, permissionKey }` from `"1"` flags (86 pairs); `tx.rolePermission.findMany()` → `createMany({ skipDuplicates: true })` for missing pairs and `deleteMany({ where: { OR: stalePairs } })` only when stale pairs exist; never touch `userPermission`. Summary `{ dataset: "permissions", rows: 42, created, updated, skipped: 0 }` (grants reported in the stdout line as `grants +n/-m`). Call it after `seedRoles` in `index.ts`.
- Check: `yarn workspace @repo/database test`, `yarn lint`, `yarn typecheck`, `yarn format:check`, `yarn verify`; smoke `yarn db:seed` twice. Commit unit C (`feat(database): add role and permission catalog with CSV seed`).

## Risks and open questions

- Ticket data facts corrected from the files: 9 regions (codes 1–9), 42 permissions (8 parents + 34 children), 86 grants; `"1102"` is super_admin+admin only, `"1202"` is the all-four example. Tests use the verified numbers. Observation for the product owner, not changed: legacy data puts 山口県 (code 35) in region 9 (九州), not region 8.
- New devDependency `csv-parse` `7.0.3` (zero deps, used only by `prisma/seed/support.ts`; `import { parse } from "csv-parse/sync"`). Re-check with `npm view csv-parse version` before `yarn add`. Alternative rejected: a split-based reader — the verified data has no quotes, but Japan Post's KEN_ALL master is quoted, so the first refresh would break it. Note that the production seed already needs a dev dependency (`tsx`), so deployments must install devDependencies for seeding.
- Decision: `access/` folder instead of `auth/` for Role/Permission so `auth/` stays "Better Auth owns these; regenerate and diff". Recorded in ADR 0005.
- Decision: join tables use `created_at` (repo rule "every table has created_at") rather than the orchestrator's `assignedAt`; `assigned_by` kept as uuid without FK.
- Decision: roles come from an inline `ROLE_SEEDS` const (4 rows; its `RoleKey` type names the permissions CSV flag columns) instead of `roles.csv`; keeps unit C at 14 files. Switch to CSV later costs one file.
- Decision: permission self-relation `onDelete: Restrict` (not SetNull): deleting a parent must not silently flatten children into top-level menu entries.
- Decision: gzip for the address file. Git compresses blobs anyway, so the saving is working-tree/checkout size (17 MB → 2.4 MB) and reviewability of PRs; cost is a non-diffable data file. `gzip -n` keeps the bytes reproducible. `.csv`/`.csv.gz` are untouched by Prettier and lint-staged (verified `lint-staged.config.mjs`).
- Address seed is insert-only (`skipDuplicates`): idempotent, but a changed master row is not updated by a re-run. Master refresh (diff or truncate-and-reload inside a transaction) is a follow-up ticket; recorded in ADR.
- Prisma Client is expected to fill `id` (uuid v7), `created_at` and `@updatedAt` client-side in `createMany`. If a `NOT NULL` violation on `updated_at` shows up in Step 8, pass `updatedAt: new Date()` explicitly per row — no schema change.
- Prisma may or may not chunk large `createMany` with the pg adapter; the seed chunks at 1,000 rows regardless. Expected load time 5–15 s; the address and whole-entrypoint tests carry a 120 s timeout. Package test wall time grows by roughly 20–30 s.
- Test files share one Postgres and run in parallel. Safety comes from `skipDuplicates: true` on every `createMany` and from updates that only touch rows whose data differs, so concurrent identical seeds never bump `updated_at`. The "no test users in a real environment" guarantee is the fail-closed `NODE_ENV` check in `seedUsers` (amendment), covered by `users.seed.test.ts` for unset, `production` and `staging`; only that file touches the seed emails, so its counts do not race.
- `users.role` values `admin`/`member` (Better Auth defaults) do not match the catalog keys except `admin`; nothing joins on them yet. Resolved by the NEXT plan below.
- Legacy `sourceRegion.csv`, `sourcePrefecture.csv` and `permissions.csv` use CRLF line endings and lack a final newline (`sourceAddress.csv` is LF). The copies are normalized to LF to match `.editorconfig`; `readCsv` keeps `trim: true` so a stray `\r` can never leak into a value or a numeric parse.
- Migration folder names: Prisma generates `<timestamp>_<name>`; the existing `0001_init` sorts first, as required.

## Out of scope

- Repositories, services, tRPC routers, validation schemas and UI for any of the new models (module-template work for later tickets; no procedures are added here, so no ability checks are needed).
- Legacy `Staff`, `Client`, `Branch`, `Department` models and their join/address tables (`SourceRegionOnStaffs`, `SourcePrefectureOnStaffs`, `SourceRegionsOnClients`, `StaffAddress`, `ClientAddress`, `BranchAddress`, `DepartmentAddress`) and `RolesOnUsers` (legacy email-keyed; superseded by `users.role`).
- Building CASL abilities from the DB permission catalog (`action` values `all`/`status` and `subject`/`modelName` strings are stored as-is, not mapped to `@repo/permissions` actions).
- Address master refresh tooling.
- Changing the runtime role set — recommended NEXT plan ("Replace admin|member with super_admin|admin|manager|staff"), files it would touch: `packages/validation/src/user.schema.ts` (`ROLES`, `roleSchema`), `packages/auth/src/access-control.ts` (`ADMIN_ROLES`, `roles`), `packages/permissions/src/rules.ts` + `packages/permissions/test/ability.test.ts` (matrix rows per role), `apps/web/features/users/role-badge.tsx`, `apps/api/src/modules/user/user.service.ts` and `packages/database/src/repositories/user.repository.ts` (`countActiveAdmins` must count `super_admin`+`admin`), `apps/api/test/support.ts` (`signedInUser` roles), `packages/database/prisma/seed/users.seed.ts` (test users' roles), `docs/adr/0002-auth.md` + `docs/adr/0003-permissions.md` (dated `## Changes` lines), and optionally a data migration mapping existing `member` rows.

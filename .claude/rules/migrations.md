---
paths:
  - "packages/database/prisma/**"
---

# Schema and migration rules (Prisma 7)

## Setup facts

- `packages/database/prisma.config.ts` owns the datasource URL (it loads the root `.env` and falls
  back to a sentinel host so `prisma generate` works without a database), the schema path
  (`prisma/schema` — a **folder**, Prisma's multi-file schema), the migrations path
  (`prisma/migrations`) and the seed command (`tsx prisma/seed/index.ts`). The datasource block has
  no `url` — that is Prisma 7.
- Multi-file schema layout under `packages/database/prisma/schema/`:
  - `schema.prisma` — the `generator` and `datasource` blocks only, no models.
  - `<module>/<model-kebab>.prisma` — one folder per module, one model per file; an enum lives in
    the file of the model that owns it. Today: `system/health-check.prisma` (`HealthCheck`),
    `auth/user.prisma`, `auth/session.prisma`, `auth/account.prisma`, `auth/verification.prisma`
    (Better Auth), `email/outbox-email.prisma` (`enum OutboxStatus` + `OutboxEmail`),
    `source/source-region.prisma` (`enum SourceArea` + `SourceRegion`),
    `source/source-prefecture.prisma` (`SourcePrefecture`), `source/source-address.prisma`
    (`SourceAddress`), `access/role.prisma` (`Role`), `access/permission.prisma` (`Permission`, with
    `visible` for a future permission-editing UI, never an authorization input),
    `access/role-permission.prisma` (`RolePermission`), `access/user-permission.prisma`
    (`enum PermissionEffect ALLOW | DENY` + `UserPermission`: a user's `ALLOW` row adds a permission
    on top of the role grants, a `DENY` row removes one), `setting/comment-template.prisma`
    (`enum CommentFor` + `CommentTemplate`: a user's personal 定型文, owner `createdBy` with
    Cascade, menus as an enum array, unique `(createdBy, short)`, hard delete — ADR 0006),
    `profile/user-profile.prisma` (`enum Position` + `UserProfile`: a 担当者's HR fields, 1:1 with
    `users`, unique 社員番号, areas as an enum array — ADR 0007),
    `profile/user-profile-region.prisma` (`UserProfileRegion`: a 担当者's 地域 by region `code`),
    and the スタッフ aggregate in `staff/` (ADR 0008): `staff.prisma` (`enum EmployeeType`,
    `enum Gender`, `enum StaffStatus` + `Staff`, soft-deleted, スタッフ番号 unique among non-deleted
    rows by a service rule), `staff-address.prisma` (`StaffAddress`, post code into
    `source_addresses`), `staff-region.prisma` and `staff-prefecture.prisma` (join tables on the
    natural codes), `staff-charger.prisma` (`StaffCharger`: 担当者 over time, `unassigned_at`),
    `staff-family-member.prisma` (`enum FamilyRelation` + `StaffFamilyMember`), `staff-memo.prisma`
    (`enum StaffMemoType` + `StaffMemo`) and `staff-job-history.prisma` (`StaffJobHistory`); the
    three lists carry a `sort_order`. `access/` is our authorization catalog; `auth/` stays Better
    Auth's, and `auth/user.prisma` only gains relation fields (`permissions UserPermission[]`,
    `profile UserProfile?`, `staffCharges StaffCharger[]`, no column, and `roleRef Role` over the
    existing `role` column), `@@index([role])` and `role`'s NOT NULL / default — see "Better Auth
    models" below.
  - Prisma merges every `.prisma` file in the folder; relations may point at models in other files.
    A new module gets a new folder.
- Seeds live in `packages/database/prisma/seed/`: one `<dataset>.seed.ts` per dataset exporting a
  `SeedFn` that returns a `SeedSummary` (`rows`, `created`, `updated`, `skipped`, and an optional
  `grants` for join rows synced next to the dataset); `support.ts` holds the types, the CSV helpers
  (`readCsv`, which also reads gzip-compressed `*.csv.gz` files, `parseInteger`, `diffByKey`,
  `chunk`) and `runSeeds` (loads the root `.env`, connects, prints one line per summary,
  disconnects). Seed tests live in `packages/database/test/seed/`. `yarn db:seed` (`prisma db seed`
  → `prisma/seed/index.ts`) is the only seed command: `index.ts` calls every dataset in order,
  parents before children (roles, permissions with their role grants, regions, prefectures,
  addresses), then `users.seed.ts`.
  - Reference datasets are idempotent: a re-run reports `created 0, updated 0` (and `grants +0/-0`
    for permissions) and leaves every `updated_at` unchanged.
  - `yarn db:seed` runs through `tsx` and `csv-parse`, both devDependencies of `@repo/database`: a
    deployment that seeds installs devDependencies.
  - The permissions seed syncs only the grants the CSV owns (roles in `ROLE_SEEDS` × the CSV's
    permission keys); grants of a permission added at runtime and `user_permissions` are never
    touched, and no permission is ever deleted. The CSV (43 rows: the legacy 42 plus our `1106`
    `changeRole` row) also carries each row's `visible` flag, which the seed writes and restores.
  - `users.seed.ts` upserts (by email) four verified test accounts, all with password `A12345678`,
    hashed with `hashPassword` from `better-auth/crypto` into a credential `Account` row so the
    normal sign-in flow works, each with a 担当者 profile (社員番号 1–4, 部署名, 役職, エリア) and
    its regions, which is why the regions seed runs first:

    | Email                  | Role          | Name (reading)              |
    | ---------------------- | ------------- | --------------------------- |
    | `super_admin@test.com` | `super_admin` | 佐藤 一郎 (サトウ イチロウ) |
    | `admin@test.com`       | `admin`       | 鈴木 花子 (スズキ ハナコ)   |
    | `manager@test.com`     | `manager`     | 高橋 次郎 (タカハシ ジロウ) |
    | `am@test.com`          | `am`          | 田中 美咲 (タナカ ミサキ)   |

    It converges rather than being idempotent: a re-run re-applies the fixtures (a fresh password
    hash, a soft-deleted or banned account restored) and always reports existing accounts as
    `updated`. It creates the accounts only when `NODE_ENV` is `development` or `test`; any other
    value (unset, `production`, `staging`) skips all four (`skipped 4`), so the same command loads
    reference data in a real environment without creating known-password logins. Remaining risk:
    `runSeeds` loads the root `.env`, so a developer `.env` (`NODE_ENV=development`) combined with a
    production `DATABASE_URL` would still create them. Seed a real environment from its own
    environment, never from a developer checkout.

- Generator `prisma-client` (not `prisma-client-js`) with `output = "../src/generated/prisma"` and
  `moduleFormat = "esm"`. The output is git-ignored and regenerated by `yarn db:generate` and on
  `postinstall`. Never commit it; never import it outside `packages/database/src`.
- The client needs the `@prisma/adapter-pg` driver adapter — see `packages/database/src/client.ts`.
- Commands (root `package.json`): `yarn db:migrate:dev` = `prisma migrate dev` (creates a migration
  locally; needs `yarn docker:up`), `yarn db:migrate` = `prisma migrate deploy` (applies committed
  migrations; used by CI, by `startTestDatabase()` — which with `{ seedReferenceData: true }` also
  runs the roles and permissions seeds — and by deployments), `yarn db:generate`, `yarn db:studio`,
  `yarn db:seed`.
- CI fails on drift: after `yarn db:migrate` it runs, in `packages/database`,
  `yarn prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`. If the
  schema files say something the migrations do not, the build is red.

## Conventions in the schema files

- Models PascalCase, mapped to snake_case tables and columns: `@@map("health_checks")`,
  `@map("created_at")`.
- Primary keys are UUID v7: `id String @id @default(uuid(7)) @db.Uuid`. Exception (ADR 0005): a pure
  join table uses a composite `@@id` over its two foreign keys (`role_permissions`,
  `user_permissions`). Reference data keeps its uuid `id` but may be related through a unique
  natural key (`source_regions.code`, `roles.key`, `permissions.key`).
- Every table has `createdAt DateTime @default(now()) @map("created_at")`; mutable tables add
  `updatedAt DateTime @updatedAt @map("updated_at")`; soft-deletable tables add
  `deletedAt DateTime? @map("deleted_at")`.
- Enums for closed sets (`OutboxStatus { PENDING SENT FAILED }`, mapped to `outbox_status`); `Json`
  for provider payloads only (`OutboxEmail.payload`); `Unsupported("...")` for types Prisma cannot
  model (PostGIS), accessed via raw SQL in a repository. Exception: `User.role` is a
  `String @default("am")` with a foreign key to `roles.key` (`onDelete: Restrict`), not an enum,
  because Better Auth writes roles as strings — the allowed set is `roleSchema` in
  `@repo/validation`, and the catalog rows are inserted by the migration so a migrations-only
  database can insert users (`docs/adr/0002-auth.md`, `docs/adr/0005-legacy-reference-data.md`).
- Relations declare `onDelete` explicitly. Index every foreign key and every column used in the
  `where` of a list endpoint.
- Export the new model's type from `packages/database/src/index.ts`.

## Existing migrations

| Migration                                                          | Contents                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_init`                                                        | `health_checks`; Better Auth tables `users`, `sessions`, `accounts`, `verifications` (+ admin plugin columns, `deleted_at`); enum `outbox_status`, table `outbox_emails`                                                                                                                                                                                                                                       |
| `20261005070927_add_source_regions_and_prefectures`                | enum `source_area`; tables `source_regions`, `source_prefectures` (FK `region_code` → `source_regions.code`, Restrict)                                                                                                                                                                                                                                                                                         |
| `20261005081809_add_source_addresses`                              | table `source_addresses` (Japan Post postal-code master; `post_code` unique, four Boolean flags)                                                                                                                                                                                                                                                                                                               |
| `20261005090103_add_roles_and_permissions`                         | tables `roles`, `permissions` (self-relation on `parent_key`, Restrict), `role_permissions`, `user_permissions` (composite primary keys; Cascade)                                                                                                                                                                                                                                                              |
| `20261005143913_align_users_role_with_roles`                       | inserts the four `roles` rows (`ON CONFLICT DO NOTHING`), backfills `users.role` (`member`/NULL → `staff`), then default `'staff'`, NOT NULL, index and FK `users.role → roles.key` (Restrict)                                                                                                                                                                                                                 |
| `20261005145534_add_permission_visible_and_user_permission_effect` | enum `permission_effect`; defaulted columns `permissions.visible` (true) and `user_permissions.effect` (`ALLOW`)                                                                                                                                                                                                                                                                                               |
| `20261007000000_add_user_name_parts`                               | nullable `users.last_name`, `first_name`, `last_name_kana`, `first_name_kana` (ADR 0002)                                                                                                                                                                                                                                                                                                                       |
| `20261008013748_add_comment_templates`                             | enum `comment_for`; table `comment_templates` (FK `created_by` → `users.id`, Cascade; unique `(created_by, short)`; ADR 0006)                                                                                                                                                                                                                                                                                  |
| `20261008044757_rename_staff_role_to_am`                           | role key `staff` → `am`: inserts `am`, moves users and `role_permissions`, deletes `staff`, default `'am'` (ADR 0002, 2026-10-08)                                                                                                                                                                                                                                                                              |
| `20261008045556_add_user_profiles`                                 | enum `position`; tables `user_profiles` (FK `user_id` → `users.id`, Cascade; unique `user_id`, `employee_number`) and `user_profile_regions` (composite key, FK `region_code` → `source_regions.code`, Restrict; ADR 0007)                                                                                                                                                                                     |
| `20261008055605_add_staffs`                                        | enums `employee_type`, `gender`, `staff_status`, `family_relation`, `staff_memo_type`; tables `staffs`, `staff_addresses` (FK `post_code` → `source_addresses`, Restrict), `staff_regions`, `staff_prefectures` (composite keys, Restrict to the codes), `staff_chargers` (FK `user_id` → `users.id`, Restrict), `staff_family_members`, `staff_memos`, `staff_job_histories` (Cascade to the staff; ADR 0008) |

The template shipped `0001_init` as its single baseline. Once a migration has been applied anywhere,
never edit it; add a new one.

## Better Auth models

`User`, `Session`, `Account`, `Verification` are Better Auth's models. **Field names must stay
exactly as Better Auth expects** (`emailVerified`, `banExpires`, `impersonatedBy`, `providerId`,
...); only table and column names are mapped (`@@map("users")`, `@map("email_verified")`). Our own
fields (`deletedAt`; `lastName`, `firstName`, `lastNameKana`, `firstNameKana`, written by the user
service, which keeps `name` = "姓 名"), the relation fields on `User`
(`permissions UserPermission[]`, no column, and `roleRef Role` over the existing `role` column with
`@@index([role])`), `role`'s NOT NULL and `@default("am")`, and the UUID v7 ids (Better Auth runs
with `generateId: false`) are merged in by hand; keep them when diffing regenerated output.

When the Better Auth config changes (new plugin, new additional field) or Better Auth is upgraded,
regenerate and diff instead of guessing:

```sh
npx auth@1.7.3 generate --config packages/auth/auth-cli.config.ts --output /tmp/better-auth.prisma -y
```

Then diff `/tmp/better-auth.prisma` against the files under `prisma/schema/auth/` by hand and port
only the field-level changes, keeping the mappings. The CLI package is `auth` (matching the
`better-auth` version), not `@better-auth/cli` — that package is stale.
`packages/auth/auth-cli.config.ts` exists only for this command; it never runs at runtime.

## Workflow for a schema change

1. Write the ADR line first: one line in the relevant `docs/adr/*.md` (or a new ADR) saying what
   changes and why. CLAUDE.md: schema changes require an ADR note. No line, no migration.
2. Edit or add the model file under `prisma/schema/<module>/<model-kebab>.prisma` following the
   conventions above (a new module gets a new folder).
3. `yarn docker:up`, then `yarn db:migrate:dev --name <verb>_<what>` (for example
   `add_user_avatar`). Read the generated SQL in
   `prisma/migrations/<timestamp>_<name>/migration.sql` before committing it.
4. Run `yarn db:generate`: Prisma 7's `migrate dev` no longer regenerates the client. Then update
   repositories, services and tests; run `yarn workspace @repo/database test` (testcontainers apply
   the new migration) and `yarn verify`.
5. Commit schema files, migration, seed changes (if any) and ADR line together.

## Expand-contract — every change is backward compatible

A deployment runs old and new code side by side for a moment, and a migration must break neither.
Split breaking changes into stages, each its own migration and release:

1. **Expand**: add the new column as nullable (or with a default), the new table, the new enum
   value. Old code ignores it.
2. **Backfill**: fill the new column in batches (a script or a raw `UPDATE ... WHERE ...` loop),
   never inside the migration that adds the column on a large table.
3. **Constrain**: once every row is filled and new code writes the column, add `NOT NULL`, the
   unique index, the foreign key.
4. **Contract** (a later release): remove the old column or table after nothing reads it.

Renames are drop + add in Prisma's eyes: do them as expand (add) → backfill → contract (remove),
never as a rename migration on a table with data.

## Never

- Never edit a migration that has been applied anywhere (CI, another developer, staging). Write a
  new migration instead. `.prettierignore` excludes `prisma/migrations` on purpose — generated SQL
  is not reformatted.
- Never `prisma migrate reset` or `prisma db push` against a shared database (`migrate reset` is
  denied in `.claude/settings.json`). Locally, a reset is acceptable only on your own Docker volume.
- Never put application logic into a migration; migrations are plain SQL.
- Never change a primary key type or a `@@map` name after the first migration that created it.

# ADR 0005 — Legacy d-round reference data in @repo/database

Date: 2026-10-05 · Status: accepted

## Context

The first d-round domain data ported from the legacy API is reference data: Japan's regions and
prefectures (`sourceRegion.csv`, `sourcePrefecture.csv`). The CSVs and the legacy schema link
rows by natural codes, not by row ids (a prefecture names its region by `regionCode`). The data
must load the same way into every environment, production included, without ever creating the
dev test accounts, and loading it twice must change nothing.

## Decision

- **Tables** `source_regions` (`SourceRegion`: `code`, `name`, `name_en`, `area`) and
  `source_prefectures` (`SourcePrefecture`: `code`, `name`, `name_en`, `region_code`) in the
  schema folder `source/`. Migration `20261005070927_add_source_regions_and_prefectures`.
- **Keys**: UUID v7 `id` primary keys as everywhere (ADR 0001) plus the natural key
  `code Int @unique`, which is the relation target: `source_prefectures.region_code` (indexed)
  references `source_regions.code`, because the CSVs and the legacy data reference codes.
- **`onDelete: Restrict`** on prefecture → region: reference data is never deleted implicitly.
- **`enum SourceArea { EAST WEST }`** mapped to `source_area` (legacy `EnumArea`), a closed set.
- **Seeds** live in `prisma/seed/` behind one command, `yarn db:seed` (`index.ts`): every
  reference dataset in order, then the test users. The test users fail closed: they are created
  only when `NODE_ENV` is `development` or `test`, so any real environment (unset, `production`,
  `staging`) gets the same reference data without known-password logins. Reference seeds are
  diff-based: they create missing rows and update changed rows only, so a re-run reports
  `created 0, updated 0` and leaves every `updated_at` unchanged.
- **`csv-parse` 7.0.3** (dev dependency of `@repo/database`, no dependencies of its own, sync
  API) reads every CSV seed.
- **Migrations** for this port are generated against a throwaway Postgres that has only the
  committed migrations applied: the shared dev database's migration history predates the
  template's squash into `0001_init`, so `migrate dev` against it would demand a reset.

## Alternatives

Autoincrement `Int` ids as in the legacy schema (breaks the UUID v7 convention); child tables
referencing the parent's uuid `id` (the CSVs carry codes, so every seed and later legacy data
migration would need a lookup); a separate production-only seed command with a lint guard against
importing the test-user seed (rejected as more machinery than a fail-closed `NODE_ENV` check in
one place); a split-based CSV reader (breaks on quoted fields such as Japan Post's KEN_ALL
master).

## Consequences

Reference tables carry both `id` and `code`; relations and lookups use `code`. A master refresh
is a CSV change plus a seed re-run, not a migration. Legacy values are ported unchanged
(山口県, code 35, stays in region 9 九州); corrections are a data ticket. `readCsv` checks every
header against the expected columns, so a renamed column fails the seed instead of being ignored.
Seeding a real environment needs the package's devDependencies installed (`tsx`, `csv-parse`,
and `better-auth`, which `users.seed.ts` imports even when it skips the accounts), and must use
that environment's own variables: a developer `.env` (`NODE_ENV=development`) pointed at a real
`DATABASE_URL` would still create the test accounts.

## Changes

- **2026-10-05** — `source_addresses` (`SourceAddress` in `source/source-address.prisma`,
  migration `20261005081809_add_source_addresses`): the Japan Post postal-code master.
  `post_code` is unique and is the lookup and future relation key (legacy
  `StaffAddress.postCode → SourceAddress.postCode`); its unique index replaces the legacy extra
  `@@index([postCode])`. The four legacy 0/1 `Int` flags become `Boolean` (default `false`);
  `update_status` and `change_reason` stay `Int` codes as Japan Post defines them. The seed is
  insert-only (`createMany` with `skipDuplicates`): the legacy CSV has 124,809 rows but 120,663
  distinct post codes, and the first occurrence of a post code wins, which is what the legacy
  MySQL `LOAD DATA LOCAL` did against its unique index. The seed's `skipped` count is those
  4,146 repeated CSV rows (constant), not failures. The legacy data lost leading zeros:
  `old_post_code` reads `"60"` for `060` and `"6805"` for `06805`, and the `Int` `jis_code` reads
  `1101` for `01101` (prefectures 01–09). Values are ported unchanged; consumers left-pad (old
  post codes of up to 3 digits to 3, longer ones to 5; JIS codes to 5). The data file is stored
  gzip-compressed (`source-addresses.csv.gz`). Unlike regions and prefectures, a re-run never
  updates a changed master row; a master refresh is a separate ticket.
- **2026-10-05** — Role and permission catalog (`Role`, `Permission`, `RolePermission`,
  `UserPermission`, migration `20261005090103_add_roles_and_permissions`) in the new schema
  folder `access/`: our authorization catalog next to Better Auth's `User`, so `auth/` stays the
  Better-Auth-owned "regenerate and diff" folder; `User` gains only the relation field
  `permissions`, no column. `roles` and `permissions` keep uuid v7 ids and, as decided for the
  regions (Keys above), relations target their natural keys `roles.key` and `permissions.key`,
  because the CSV and later legacy data migrations carry keys. The only exception to the uuid
  rule: the join tables `role_permissions` and `user_permissions` use composite primary keys
  (`@@id([roleKey, permissionKey])`, `@@id([userId, permissionKey])`) instead of a uuid `id`.
  Legacy mapping: the `EnumUserRole` keys `SUPER_ADMIN | ADMIN | MANAGER | STAFF` become the
  lower-case `super_admin`, `admin`, `manager`, `staff`, matching how Better Auth stores
  `users.role`; the CSV's role column headers are renamed to match, its values are unchanged and
  only its line endings changed (CRLF to LF, plus a final newline). The legacy Japanese
  `Role.name` becomes `name_jp`, and `name` is a new English value. `PermissionsOnRoles` and
  `PermissionsOnUsers` become `role_permissions` and `user_permissions`; the latter references
  `users.id` through `user_id` instead of the legacy `userEmail`, and the email-keyed
  `RolesOnUsers` is not ported (`users.role` replaces it). The legacy `assignedAt` becomes
  `created_at` per the repo rule, `assigned_by` stays a plain uuid column without a foreign key
  (an audit value; seeds write null), and the legacy `createdBy` / `updatedBy` on permissions are
  dropped. There is no foreign key `users.role → roles.key`: Better Auth owns that column and its
  allowed set stays `roleSchema` (ADR 0002); `member`, Better Auth's default role, has no catalog
  row until the role-set ticket. The parent self-relation
  `permissions.parent_key → permissions.key` is `onDelete: Restrict`, so deleting a menu group is
  deliberate and never silently flattens its children into top-level entries; grants cascade with
  their role, permission or user. The seed syncs only the role grants the CSV owns (catalog roles
  × CSV permissions) to its flags: it adds missing grants, removes stale ones and prints the
  changes as `grants +n/-m`. Grants of a role or permission outside the CSV (for example one added
  at runtime) and `user_permissions` are never touched, and the seed never deletes a permission.
- **2026-10-05** — `users.role → roles.key` is now a foreign key (migration
  `20261005143913_align_users_role_with_roles`: `roleRef Role` on `User` over the existing `role`
  column, `users User[]` on `Role`, `onDelete: Restrict`, `@@index([role])`), reversing the
  "no foreign key" decision above. It is safe now because public sign-up is off (ADR 0002), the
  catalog is complete (the four keys are the whole role set; `member` has no row and no users),
  and Better Auth rejects a role outside its `roles` map before it reaches the column, so
  nothing legitimate can write a key the catalog does not have. The migration inserts the four
  role rows itself (`ON CONFLICT ("key") DO NOTHING`, so an already-seeded database is left as it
  is) because a migrations-only database — testcontainers, CI, a fresh deploy before
  `yarn db:seed` — must be able to insert users; their ids use `gen_random_uuid()` (uuid v4)
  rather than uuid v7 because `uuidv7()` exists only from PostgreSQL 18 and the production
  version is not pinned, and the ids are never referenced. Rows with a role outside the catalog
  (`member`, `NULL`) are backfilled to `staff` in the same migration: `users` is small, so the
  expand → backfill → constrain steps may share one file. The seed stays the owner of the names
  (`seedRoles` restores a drifted name in place) and never deletes a role, which Restrict would
  refuse anyway while a user holds it.

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

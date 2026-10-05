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
  reference dataset in order, then the test users, which are skipped with `NODE_ENV=production`
  so production gets the same reference data without known-password logins. Reference seeds are
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
importing the test-user seed (rejected as more machinery than a `NODE_ENV` check in one place); a
split-based CSV reader (breaks on quoted fields such as Japan
Post's KEN_ALL master).

## Consequences

Reference tables carry both `id` and `code`; relations and lookups use `code`. A master refresh
is a CSV change plus a seed re-run, not a migration. Legacy values are ported unchanged
(山口県, code 35, stays in region 9 九州); corrections are a data ticket. Seeding production
needs the package's devDependencies installed (`tsx`, `csv-parse`).

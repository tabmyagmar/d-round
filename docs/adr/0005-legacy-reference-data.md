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
- **Seeds** live in `prisma/seed/` with two entrypoints: `index.ts` (`yarn db:seed`, dev only:
  reference data, then the test users; refuses `NODE_ENV=production`) and `reference.ts`
  (`yarn db:seed:reference`, production-safe: the `REFERENCE_SEEDS` registry only). The lint
  rule `database/seed-production-safe` forbids reference seeds from importing the test-user seed
  or Better Auth. Reference seeds are diff-based: they create missing rows and update changed rows
  only, so a re-run reports `created 0, updated 0` and leaves every `updated_at` unchanged.
- **`csv-parse` 7.0.3** (dev dependency of `@repo/database`, no dependencies of its own, sync
  API) reads every CSV seed.
- **Migrations** for this port are generated against a throwaway Postgres that has only the
  committed migrations applied: the shared dev database's migration history predates the
  template's squash into `0001_init`, so `migrate dev` against it would demand a reset.

## Alternatives

Autoincrement `Int` ids as in the legacy schema (breaks the UUID v7 convention); child tables
referencing the parent's uuid `id` (the CSVs carry codes, so every seed and later legacy data
migration would need a lookup); one combined seed file (test users must stay physically separate
from the data production loads); a split-based CSV reader (breaks on quoted fields such as Japan
Post's KEN_ALL master).

## Consequences

Reference tables carry both `id` and `code`; relations and lookups use `code`. A master refresh
is a CSV change plus a seed re-run, not a migration. Legacy values are ported unchanged
(山口県, code 35, stays in region 9 九州); corrections are a data ticket. Seeding production
needs the package's devDependencies installed (`tsx`, `csv-parse`).

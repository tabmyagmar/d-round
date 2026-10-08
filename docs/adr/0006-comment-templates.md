# ADR 0006 — Comment templates (定型文) as personal data

Date: 2026-10-08 · Status: accepted

## Context

The legacy 定型文管理 screen lets every signed-in user keep short texts that paste into a comment or
memo box: a title (`short`, ≤100 characters), a text (`content`, ≤1000) and the menus it is for
(`EnumCommentFor`: `WORKFLOW` ワークフロー承認画面用コメント, `APPLICATION` ワークフロー一覧用メモ,
`CLIENT` クライアント管理, `STAFF` スタッフ管理). The legacy API stored them in two MySQL tables,
`CommentTemplate` (`short`, `content`, `status`, `createdBy`, `updatedBy`, unique
`(short, createdBy)`) and `CommentTemplateType` (one row per menu), and every query filtered
`createdBy = the caller`: a template belongs to the user who wrote it. Nothing read `status`, the
only writer of `updatedBy` was the owner, and deletes were hard deletes of both tables in one
transaction. The legacy audit logger had these mutations switched off.

## Decision

- **One table** `comment_templates` (`CommentTemplate` in the schema folder `setting/`, migration
  `add_comment_templates`): `id` (UUID v7), `created_by` (the owner, a foreign key to `users.id`,
  `onDelete: Cascade`), `types comment_for[]`, `short VARCHAR(100)`, `content TEXT`, `created_at`,
  `updated_at`.
- **`enum CommentFor { WORKFLOW APPLICATION CLIENT STAFF }`** mapped to `comment_for`, a closed set
  as the legacy enum; the menus a template is for are a Postgres enum array instead of a join table,
  which existed only because MySQL has no arrays. Filtering by menu is `types: { has: type }`.
- **Unique `(created_by, short)`**: one title per owner, as the legacy `my_comment` key; another
  user may reuse the title. The index also serves the list query, which always filters on
  `created_by`.
- **Hard delete**, as the legacy. No `deleted_at`: a soft delete would need the unique key to ignore
  deleted rows (a partial index Prisma cannot express) for data nobody audits.
- **Dropped legacy columns**: `status` (never read) and `updated_by` (always the owner).
- **Ownership** is a row rule in CASL, not a catalog grant (ADR 0003, 2026-10-08).

## Alternatives

The legacy join table (one more model and `include` / `some` filters for a four-value set that never
grows per row); a `Json` column of menu keys (no enum check in the database); soft delete with a
partial unique index in raw SQL (drift between the schema files and the database that `migrate diff`
would report); a `status` column kept for parity (dead data).

## Consequences

A template disappears with its owner (Cascade); users are soft-deleted in this repo, so in practice
templates outlive a deactivation and come back with a reactivation. A later "share a template with
the team" feature needs a new column or table and a new rule; nothing here assumes it. Porting
legacy rows is a mapping of `CommentTemplateType` rows into the array.

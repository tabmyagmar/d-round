# ADR 0015 — Audit log (アクセスログ): rows written with the change, append-only

Date: 2026-10-14 · Status: accepted

## Context

The legacy d-round-api records every GraphQL mutation in a `graphql-middleware`
(`src/graphql/middlewares/audit-logger.ts`): after the resolver, outside its writes, it stores the
user's name, email and role, the mutation's name, its return type and `{ args, result }` as they
were. That stores the typed password of every sign-in (failed ones too), the issued access and
refresh tokens, both passwords of a change and every CSV file downloaded or uploaded, for 3 months;
the target is the GraphQL return type (`String!`) with an id that is null for most mutations; admins
delete rows from the screen without a trace; and a failed log insert turns a committed mutation into
an error. romuten-v3 ports the same middleware with masking and a fire-and-forget write
(`docs/requirements/2026-07-03-audit-log-backend.md`). The brief asks for before and after, filters,
an entity's history, masking, append-only rows and a write that never breaks the mutation.

## Decision

- **Rows are written by the services, in the write's transaction.**
  `recordChanges(ctx, db, entries)` (`apps/api/src/modules/audit-log/audit-log.service.ts`) runs
  inside the write's `withTransaction` (on `ctx.db` where a write has none): a change commits with
  its row or not at all, and the row knows the business action, the exact entity and its before (the
  services load the row for their checks) and after (they reload it to return it), mostly without an
  extra query: an edit of a 担当者 also reads its permission overrides and the catalog's names,
  a スタッフ write its 履歴書 names. CSV imports call the services and are recorded the same way,
  the uploader as actor.
- **Failures and sign-in events are best effort.** A tRPC middleware (`auditFailures`, part of
  `protectedProcedure`) records one `FAILURE` row with the error code when a mutation fails; Better
  Auth hooks record sign-in, sign-out, password and `/admin/*` events through an injected
  `onAuthEvent`. Neither can share a transaction, so their insert is awaited, caught and logged —
  never rethrown.
- **Two Better Auth paths around the log are closed.** `/update-user` is disabled (`disabledPaths`;
  the web changes a name through `user.updateProfile`, which records it), and the admin roles keep
  ADR 0003's `adminAc` without `impersonate`: an impersonated session would put the target's name on
  the admin's writes. Better Auth's other writes stay events, not changes: an `/admin/*` call
  records its endpoint and a role, not the fields `/admin/update-user` sets; `/verify-email` and the
  session revocations are not recorded.
- **Coverage.** Every mutation is a key of `AUDIT_ACTIONS` (`@repo/validation`) or exempt with
  `meta({ audit: false })`; a test over `appRouter._def.procedures` fails otherwise.
- **Table `audit_logs`** (schema folder `audit/`, migration `add_audit_logs`): snapshots of the
  actor (id, name, email, role; no foreign keys), the action key, the target (type, id, label), the
  status and error code, the changed fields, request id, IP and user agent. `changes` is `Json` — an
  exception to "Json for provider payloads only", as `csv_import_rows.data` is, because its fields
  differ per entity. Five btree indexes, one per list filter, each ending in `created_at`.
- **Only an allow-listed view is stored.** No input, result or request body: a change row holds the
  changed fields of the entity's audit view (the CSV download's columns and cells plus the fields a
  form changes that a download leaves out); personal fields the registry marks `masked` record that
  they changed, not their values.
- **Append-only, 90 days.** No update or delete path in the code; a trigger in the migration refuses
  `UPDATE`, `TRUNCATE` and the `DELETE` of a row younger than 90 days. The worker's sweeper deletes
  older rows daily at 04:00 JST and records one `SYSTEM` row with the count. The legacy screen's
  delete is not ported; catalog row 1504 (`AuditLog delete`) is granted to nobody.
- **Read by the admin roles.** `read AuditLog` (catalog row 1502): super_admin and admin, every row.

## Alternatives

- **A tRPC middleware for every row** (the legacy and romuten-v3 shape) — no before without an extra
  read per entity type, no rows for a bulk write's entities, none for CSV imports (the worker calls
  the services, not tRPC) or Better Auth (not tRPC).
- **A Prisma client extension** — the data layer has no request context, so the API would push one
  down through `AsyncLocalStorage` (a second context beside `buildRequestContext`, against the layer
  contract); one action is several queries; every write needs an extra `SELECT`; `updateMany`,
  `deleteMany` and raw SQL have no per-row before; Better Auth's token writes would have to be
  filtered out. Prisma 7 has no `$use` middleware.
- **BullMQ or fire-and-forget writes** — `.claude/rules/queue.md` allows IDs only in a payload, so
  an async write needs its row first (ADR 0004), which would already be the log row; an event held
  in Redis is lost on a flush and can outlive a rolled-back change; fire-and-forget loses rows
  silently on a crash.
- **Masking by key names** (romuten-v3 `MASKED_ARG_KEYS`) — fails open: a new field leaks until
  someone adds its name. The allow-list fails closed.
- **Partitions** — not at this size (0.2–1.6 M rows over 90 days, estimated); worth it past ~50 M
  rows or when the daily delete takes minutes: monthly `RANGE (created_at)` partitions in a raw-SQL
  migration, retention by `DROP PARTITION`, the next partitions created by the sweeper.

## Consequences

- A write gains one `INSERT` on its open connection (well under a millisecond on a local database).
  The insert fails only when the database fails, and then the write fails anyway.
- Every new write function records its entries, and its test asserts them
  (`.claude/rules/module-template.md`, `.claude/rules/testing.md`).
- Shortening the retention needs a migration (the trigger holds the 90 days).
- The owner of the tables can still drop the trigger: a runtime database role without DDL rights is
  a deployment follow-up.
- The legacy MySQL `AuditLog` rows hold passwords and tokens: they are not imported, and the legacy
  table should be emptied when the legacy app is retired.

# Plan: アクセスログ — the legacy audit log on the new layers (epic)

Branch: `feature/D_ROUND-TBD_audit-log`, cut from `develop` (`92fa4ba`: the CSV import and the queue
dashboard merged). Status: **approved 2026-10-14** ("ok heregjuul": every open question takes its
recommended answer), in progress. Phase 1 (how the legacy writes and shows its log) was explained in
chat on 2026-10-14; this plan is phase 2 of the brief: (a) the flow comparison, (b) the architecture
decisions, (c) the Backlog tickets. Decisions marked **⚑** need the user's answer (open questions at
the end of (b)); each names its reference.

Read before this plan — legacy API (`../d-round-api`, develop `23266a2`, equal to GitHub):
`src/graphql/middlewares/{audit-logger,shield}.ts`, `src/graphql/index.ts`,
`src/database/schema/source/auditLog.prisma`, `src/database/schema/enums.prisma`,
`src/database/migrations/20250922104440_audit_log/migration.sql`,
`src/graphql/schema/{auditLog,auth,user,source,csv-download}.ts`,
`src/graphql/resolvers/audit-log/*.ts`, `src/graphql/resolvers/auth/mutations.ts`,
`src/graphql/resolvers/user/mutations.ts`, `src/graphql/resolvers/csv/download/mutations.ts`,
`src/jobs/{index,system/index,system/audit-log}.ts`, `src/config/env.ts`, `.env.example`,
`src/database/seed/data/permissions.csv`, `src/utils/pagination.ts`, `src/server.ts`; legacy web
(`../d-round-web`, develop `b06d7fc7`): `src/app/admin/master/log/page.tsx`,
`src/features/accessLog/**`, `src/shared/lib/enums/values.ts`; romuten-v3
(`../../romuten/v3/romuten-v3`): `docs/requirements/2026-07-03-audit-log-backend.md`,
`packages/database/prisma/log/auditLog.prisma`, `apps/backend/src/graphql/audit/index.ts`,
`apps/backend/src/modules/auditLog/**`,
`apps/backend/src/lib/bullmq/schedules/auditLogCleanup.schedule.ts`,
`apps/web/src/features/auditLog/**`; this repo: `CLAUDE.md`, `protocol.md`,
`.claude/rules/{layers,module-template,permissions,queue,repositories,migrations,testing,ui,docs}.md`,
`.claude/skills/feature-screen/SKILL.md`, `docs/adr/{0004,0008,0013,0014}-*.md`, `docs/auth.md`,
`apps/api/src/{app.ts,core/context.ts,trpc/init.ts,trpc/router.ts,middleware/*.ts,jobs/app-auth.ts}`,
`apps/api/src/modules/{client,user,csv-import,csv-export}/*.ts`, `packages/auth/src/server.ts`,
`packages/logger/src/index.ts`, `packages/queue/src/names.ts`, `apps/worker/src/schedulers/*.ts`,
`packages/validation/src/csv-export.schema.ts`,
`packages/database/prisma/seed/data/permissions.csv`, `apps/web/config/{routes,nav}.ts`, the five
detail and list pages under `apps/web/app/admin/` this plan touches,
`packages/ui/src/components/composed/README.md`. Library behaviour was read in the installed
packages, as Context7's monthly quota ran out after its first call: better-auth 1.7.3
`dist/api/dispatch.mjs`, `dist/api/routes/{sign-out,session}.mjs` and `@better-auth/core`
`dist/types/{context,init-options}.d.mts`; `@trpc/server` 11.18.0 types (`meta`, a middleware's
`meta` / `path` / `type`, `_def.procedures`); prisma 7.10.0 `runtime/client.d.ts` (`$extends`, no
`$use`); bullmq 6.3.4 `RepeatOptions` (`pattern`, `tz`).

## Goal and acceptance criteria

Port the legacy アクセスログ — a record of every write, shown in 「アクセスログ管理」 — onto trpc →
service → repository; close the legacy gaps (passwords, tokens and whole files in the log, a target
nobody can identify, deletable rows, a failed log write breaking a saved change); add what the brief
asks for: before and after, filters, an entity's history, mobile.

1. Every tRPC mutation records audit rows or is exempt by `meta({ audit: false })`; a test fails for
   a mutation that is neither.
2. A successful write records one row per entity it changed, **in the same transaction**: actor
   (snapshot), action, target (type, id, label), the changed fields with before and after, request
   id, IP, user agent. A rolled-back write leaves no row of its change.
3. A failed mutation (forbidden, invalid input, not found, conflict, server error) records one
   `FAILURE` row with its error code; writing that row never changes the response.
4. Sign-in (success, and failure with the typed address), sign-out, password change, forgot
   password, password set from a mailed link and every HTTP call to Better Auth's
   `/api/auth/admin/*` are recorded; Better Auth answers exactly as before when recording fails.
5. A CSV import records its upload and confirmation and each
   imported 担当者 / スタッフ / クライアント / 就業先部署 as that service's action, with the
   uploader as actor; a download and a re-download from 履歴 are recorded.
6. No password, token, cookie, signed URL, request body or file content can reach a row: rows hold
   an allow-listed view of the entity only; masked fields record that they changed, not their values
   (⚑2).
7. Rows cannot be updated, and rows younger than the retention cannot be deleted (database trigger);
   the worker deletes older rows once a day and records how many.
8. 「アクセスログ管理」 lists the rows (日付, 時間, 担当者, アクション, 対象, ステータス), searches
   actor and target, filters アクション, 対象, ステータス and 期間, and pages (⚑5); a row opens a
   detail with the before / after table. There is no delete.
9. The 担当者, スタッフ, クライアント and 就業先部署 detail pages offer 「変更履歴」 to
   `read AuditLog` holders: the entity's rows with their changes (⚑6).
10. Below `md` the filters, the detail and the history open as bottom drawers; every screen works at
    375 px.
11. Every new procedure has `requireAbility("read", "AuditLog")`; the sweeper follows the queue
    rules; `yarn verify` is green per commit; each screen is browser-checked as super_admin and
    admin (manager and AM: no menu, 403) next to the legacy screen.

## (a) Flow comparison

### Legacy, as built

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as graphql-shield
    participant L as auditLogger (graphql-middleware)
    participant R as Resolver
    participant DB as MySQL
    B->>S: mutation (args)
    S-->>B: PERMISSION_DENIED — not recorded (shield runs outside the logger)
    S->>L: allowed
    L->>R: resolve(args)
    R->>DB: the resolver's own writes, committed
    R-->>L: result (an id string, a Boolean, LoginPayload with JWTs, a base64 file …)
    L->>DB: INSERT AuditLog {name, email, role, action, entity = return type, entityId = result.id, metadata {args, result}}
    Note over L,DB: the INSERT fails → catch → ERROR INSERT → the committed mutation answers with an error
    L-->>B: result
    Note over DB: cron 00:00 in the API process (RUN_CRON): delete rows older than 3 months, 100 at a time
    B->>DB: アクセスログ: offset page, search, アクション filter; 削除 of selected rows (not recorded)
```

### New

```mermaid
sequenceDiagram
    participant B as Browser
    participant T as tRPC (protectedProcedure + auditFailures)
    participant SV as Service
    participant DB as Postgres
    participant BA as Better Auth (/api/auth)
    participant W as Worker
    B->>T: mutation
    T->>SV: requireAbility → input → service
    SV->>DB: BEGIN; load the row (its checks need it) = before
    SV->>DB: write; reload the row (to return it) = after
    SV->>DB: INSERT audit_logs (actor, action, target, changed fields, request); COMMIT
    SV-->>T: result
    T-->>B: result
    Note over T,DB: failure (rolled back): auditFailures INSERTs one FAILURE row (best effort), returns the error unchanged
    B->>BA: sign-in, sign-out, change / forgot / reset password, admin/*
    BA->>DB: Better Auth's own writes
    BA->>DB: hook → onAuthEvent → INSERT audit_logs (best effort)
    W->>DB: daily 04:00 JST: DELETE rows past the retention in batches; INSERT one SYSTEM row
    B->>T: auditLog.list / byId / history (read AuditLog)
```

### Side by side

| Stage                  | Legacy d-round                                                                                | romuten-v3                                           | New                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Where a row is written | `graphql-middleware` around every Mutation, after the resolver, awaited, outside its writes   | the same, fire-and-forget (`void record().catch`)    | inside the service's write transaction (D1)                                                        |
| Which mutations        | `logger(true / false)` per field; the `AuditLogger` type forces a choice for every field      | `auditLogMap` entry or `false`, a completeness test  | `AUDIT_ACTIONS` key or `meta({ audit: false })`, a coverage test (D8)                              |
| Actor                  | name, email, role snapshot; no id                                                             | id, email, role snapshot                             | id, name, email, role snapshot; `SYSTEM` for jobs; the typed address for a failed sign-in (D2)     |
| Target                 | the GraphQL return type (`String!`, `Boolean!`); `entityId` = `result.id`, mostly null        | target / action / event codes                        | entity type, id and label of each changed row (D2)                                                 |
| Content                | `metadata {args, result}` as they were: passwords, JWTs, whole CSV files                      | masked args, 10 kB cap                               | the changed fields of the entity's audit view, before and after (D3, D4)                           |
| Failures               | `ERROR` row with the args; shield denials not recorded                                        | error rows, denials included                         | `FAILURE` row with the error code, denials included (D1)                                           |
| A failing log write    | the committed mutation answers with an error                                                  | the row is lost silently                             | fails with its write (only when the database fails); failure rows and auth events best effort (D5) |
| Auth                   | login, logout, forgot / change password with their args                                       | login, forgot, reset with masked args                | Better Auth hooks: sign-in, sign-out, change, forgot, reset, `/admin/*` (D9)                       |
| Background writes      | the CSV cron wrote without a row                                                              | —                                                    | a CSV import writes through the services: a row per imported entity, the uploader as actor         |
| Retention              | cron 00:00 in the API process (`RUN_CRON`), server time zone, 3 months in code, 100 per batch | BullMQ schedule 04:00 JST, 3 months                  | worker job scheduler 04:00 JST, 90 days (⚑3), batches of 1,000, one SYSTEM row (D6)                |
| Immutability           | SUPER_ADMIN and ADMIN delete rows, unrecorded                                                 | — (no read side yet)                                 | no delete path; a trigger refuses UPDATE and the DELETE of young rows (D7)                         |
| List                   | ID, 担当者, 日付, 時間, アクション, ステータス; search; アクション filter; offset             | 権限, 企業, 結果, クライアント, 日時 filters; offset | D10                                                                                                |
| Detail                 | none (`auditLog(id)` exists, unused)                                                          | `AuditLogDetailDialog`: sections, the raw JSON       | a dialog with sections and the before / after table (D11)                                          |
| Entity history         | none                                                                                          | none                                                 | 「変更履歴」 on four detail pages (D12)                                                            |
| Who reads              | `read Admin_Log`: SUPER_ADMIN, ADMIN                                                          | admin                                                | `read AuditLog`: super_admin, admin (D14)                                                          |

### Legacy gaps this plan closes

1. **G1** — secrets and files in the log: `login` stores the typed password (failed attempts too)
   and the issued access and refresh tokens; `changePassword` both passwords; every CSV download the
   whole file (`DownloadCsv.buffer`, base64); `uploadSourceCsv` every row — kept 3 months, readable
   from the database and its backups.
2. **G2** — rows can be deleted from the screen (catalog row 1504, SUPER_ADMIN and ADMIN), and
   `deleteAuditLog(s)` are `logger(false)`: an admin can remove rows without a trace.
3. **G3** — the log INSERT sits in the resolver's `try`: when it fails, a mutation that already
   committed answers with an error (and the `ERROR` INSERT most likely fails as well).
4. **G4** — `entity` is the GraphQL return type and `entityId` is null for every mutation that
   returns `String!` or `Boolean!` (most of them); the actor has no id — no per-record history, and
   a renamed user's rows lose their owner.
5. **G5** — no before and after: only the arguments, and no screen shows them.
6. **G6** — a mutation shield refuses is not recorded.
7. **G7** — the cleanup runs in the API process when `RUN_CRON` is set, in the server's time zone,
   with its 3 months in code.
8. **G8** — the list filters by action only (no period, status or target); `duration` is a string.

## (b) Architecture decisions

### D1 ⚑ Where a row is written: in the service's transaction, plus failures and auth events

| Option                                                                       | Sees                                                                                                                                                                                              | Misses                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — tRPC middleware with procedure `meta` (the legacy and romuten-v3 shape)  | path, raw input, result or error and `ctx` (actor, request) of every mutation, without code in the services                                                                                       | the row before the change (one more read per entity type), which rows a bulk write touched, CSV imports (the worker calls the services, not tRPC), Better Auth (not tRPC)                                                                                                                                                                                                                                                                                                                                                           |
| B — Prisma client extension (`$extends` → `query.$allModels.$allOperations`) | every query, the worker's and Better Auth's included                                                                                                                                              | who and from where: `packages/database` has no request context, so the API would push one down through `AsyncLocalStorage` — a second context beside `buildRequestContext`, against `.claude/rules/layers.md`; one action is several queries (`client.update` = fields + regions + chargers); every write needs an extra `SELECT` for its before; `updateMany`, `deleteMany` and raw SQL have no per-row before; Better Auth's session and token writes must be filtered out; no action names. (Prisma 7 has no `$use` middleware.) |
| C — an explicit call in the service                                          | the business action, the exact entity, its before (services load the row for their permission and state checks) and after (they reload it to return it), in the same transaction; CSV imports too | failures (rolled back with the transaction); can be forgotten                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Decision (recommended):** C for changes, A for failures, Better Auth hooks for sign-in and its kin
(D9), and a coverage test against forgetting (D8).

- `apps/api/src/modules/audit-log/audit-log.service.ts` → `recordChanges(ctx, db, entries)`, called
  inside the write's `withTransaction` with its `tx`; a write without a transaction
  (`user.sendPasswordReset`, `csvExport.create`) passes `ctx.db`. One entry per entity; a bulk
  delete is one `createMany`.
- `auditFailures`, a middleware in `apps/api/src/trpc/init.ts` and part of `protectedProcedure`, so
  it wraps `requireAbility` and the input parsing: when a mutation fails it records one `FAILURE`
  row (action = the path, error code = the domain error's code or the tRPC code), catches and logs
  its own error, and returns the original result untouched.
- Alternatives: A alone (legacy parity; no before and after without extra reads, CSV-imported rows
  invisible); B (rejected above).

### D2 Data model (schema folder `audit/`, migration `add_audit_logs`, ADR 0015)

```prisma
/// A signed-in user, a job of the system, or nobody known (a failed sign-in).
enum AuditActorType {
  USER
  SYSTEM
  ANONYMOUS

  @@map("audit_actor_type")
}

enum AuditStatus {
  SUCCESS
  FAILURE

  @@map("audit_status")
}

model AuditLog {
  id          String         @id @default(uuid(7)) @db.Uuid
  createdAt   DateTime       @default(now()) @map("created_at")
  actorType   AuditActorType @map("actor_type")
  /// Snapshots, no foreign keys: a row outlives a rename and never blocks a delete.
  actorId     String?        @map("actor_id") @db.Uuid
  actorName   String?        @map("actor_name")
  /// For a failed sign-in, the address that was typed.
  actorEmail  String?        @map("actor_email")
  actorRole   String?        @map("actor_role")
  /// An `AUDIT_ACTIONS` key: the tRPC path (`client.update`), `auth.signIn`, …
  action      String         @db.VarChar(64)
  entityType  String?        @map("entity_type") @db.VarChar(32)
  entityId    String?        @map("entity_id") @db.Uuid
  /// What the target was called then (`1024 株式会社サンプル`), for the list and after a delete.
  entityLabel String?        @map("entity_label")
  status      AuditStatus
  errorCode   String?        @map("error_code") @db.VarChar(64)
  /// `[{ field, before, after }]` of the entity's audit view (D3); a masked field has no values.
  changes     Json?
  requestId   String?        @map("request_id")
  ipAddress   String?        @map("ip_address")
  userAgent   String?        @map("user_agent") @db.VarChar(512)

  @@index([createdAt, id])
  @@index([actorId, createdAt])
  @@index([entityType, entityId, createdAt])
  @@index([action, createdAt])
  @@index([status, createdAt])
  @@map("audit_logs")
}
```

- A UUID v7 id as every table (`.claude/rules/migrations.md`); the legacy integer ID is not shown
  (D10). No `updatedAt`: the table is append-only (D7). `Json` for `changes` is an exception to
  "Json for provider payloads only", as `csv_import_rows.data` is: its fields differ per entity (ADR
  0015 names it).
- Request data comes from `RequestContext`, built once in `apps/api/src/core/context.ts`:
  `requestId` (exists), `ipAddress` (new: the Hono layer passes `clientIp(c)` from
  `middleware/rate-limit.ts`, the IP rule the rate limiter already uses), `userAgent` (new, from the
  headers). `buildJobContext` leaves both null and keeps the confirming request's id as `requestId`,
  so a CSV import's rows share it.
- `packages/validation/src/audit-log.schema.ts` (browser-safe, so the web reads it directly — no
  `auditLogActions` query as the legacy had): `AUDIT_ACTIONS` (key → `{ label, entityType }`, the
  legacy `MutationJpNameMap` wording renamed after today's screens, table in D8),
  `AUDIT_ENTITY_TYPES` (`User` 担当者, `Staff` スタッフ, `Client` クライアント, `Branch` 就業先部署,
  `CsvImport` CSV取込, `CsvExport` CSVダウンロード, `AuditLog` アクセスログ),
  `AUDIT_LOG_RETENTION_DAYS`, `AUDIT_FIELDS` (D3), the list, byId and history input schemas.

### D3 Before and after: each entity's audit view, built from the download's cells

- A row keeps **the changed fields only** (`{ field, before, after }`), not two snapshots: an update
  lists what differs; a create lists every non-empty field as `after`; a status
  change, 利用停止 and 利用再開 are an update of ステータス; a delete keeps the label only (entities
  are soft-deleted and stay readable). An update that changes nothing still records its row, with no
  fields, so every successful mutation leaves a row.
- The values come from one **audit view** per entity: a flat record of display strings. It reuses
  what the CSV download already defines instead of a new label map: the columns
  `USER_EXPORT_FIELDS`, `STAFF_EXPORT_FIELDS`, `CLIENT_EXPORT_FIELDS`, `BRANCH_EXPORT_FIELDS` (key
  and Japanese header, `@repo/validation`) and their cells `USER_CELLS`, `STAFF_CELLS`,
  `CLIENT_CELLS`, `BRANCH_CELLS` (`apps/api/src/modules/csv-export/csv-exporters.ts`: labels instead
  of codes, names instead of ids, `YYYY/MM/DD`) — what the screens and the file show. The view adds
  the fields a download leaves out but a form changes: 担当者 アカウントタイプ (role), 権限設定 (the
  overrides); スタッフ 在籍情報 (every period, not only the latest), 家族情報, メモ, 履歴書 (file
  names). A test per entity fails when a field of its create schema has no view field.
- The before costs no extra query: `update`, `changeStatus`, `deactivate` and `reactivate` already
  load the row (their permission and state checks — `client.update` loads `current`) and reload it
  to return it; `removeMany` already reads the rows' statuses (`findStatuses`), whose select only
  gains the label columns. A Prisma extension would add one `SELECT` per write.
- Size: a view is 12–25 short strings; a staff create with family members and memos stays around 2–4
  kB. `changes` is capped at 16 kB (long values cut, the entry marked `truncated`).

### D4 ⚑ Sensitive data: an allow-list by construction, personal fields masked

- **Secrets cannot enter.** Nothing stores an input, a result or a request body: change rows hold
  audit-view fields only (an allow-list), failure rows the action and the error code, auth events
  the actor, the typed address and the error code — the hook never reads `password`, `newPassword`
  or `token`. Tests: each view's keys equal its registry's; the auth-event tests assert that no row
  contains the password or the token they sent.
- **Personal data (⚑2).** The brief asks to mask 個人情報. Recommended: `AUDIT_FIELDS` marks these
  fields `masked`
  — スタッフ 生年月日, 電話番号, 緊急連絡先（電話番号）, メールアドレス, 郵便番号, 住所（県・市）, 住所, 家族情報; 就業先部署 連絡担当者 メールアドレス; 担当者 メールアドレス —
  and the row records `{ field, masked: true }`, shown as 「変更あり（非表示）」: who changed it and
  when stays, the value gets no second copy in a table kept for 90 days. Names (姓, 名, セイ, メイ)
  stay: they identify the row. Alternative: keep the values (the readers, the admin roles, see the
  same data on the detail pages, and the log could answer "what was the old number").
- IP address, user agent and the actor's email are kept as in the legacy, read only by
  `read AuditLog` holders.

### D5 Performance and failure: synchronous, in the transaction, no queue

- One `INSERT` (or `createMany`) on the transaction's open connection, roughly 0.3–1 ms locally,
  beside the 3–10 queries a write already runs there. A change commits with its row or not at all:
  no change without a row, no row for a rolled-back change.
- The brief's "a log failure must not break the mutation": inside the transaction the INSERT fails
  only when the database fails (the write fails then anyway) or when a view builder has a bug;
  builders never throw on data (a missing relation is ""), and each is unit-tested. Failure rows and
  auth events cannot share a transaction (it rolled back, or the writes are Better Auth's): they are
  awaited, caught and logged with the request id (`logger.error`, which also alerts Discord, ADR
  0010), never rethrown.
- BullMQ does not write rows. `.claude/rules/queue.md` rule 1 allows IDs only in a payload, so an
  async write needs its row first (the outbox, ADR 0004) — and that row would already be the log
  row; an event held in Redis instead is lost on a flush or an eviction and can outlive a
  rolled-back change. romuten-v3's fire-and-forget (`void record().catch`) saves the millisecond and
  loses rows silently on a crash. Redis and the worker run the retention job only (D6).

### D6 ⚑ Indexes, growth, partitions and retention

- Indexes: one per list filter, each ending in `created_at` for the order, plus the history's
  `(entity_type, entity_id, created_at)` — five btrees (D2). The search on actor name, email and
  target label is `contains` without an index: within the retention and the chosen period it scans
  at most ~1.6 M rows; a `pg_trgm` index is the remedy if it gets slow, not added now.
- Growth (assumptions for the user to correct): 100–300 担当者, 20–60 writes each per working day,
  plus two sign-ins → 2,000–18,000 rows a day; 0.5–2 kB a row with its indexes → under 40 MB a day;
  with 90 days kept, 0.2–1.6 M rows and 0.1–3 GB.
- No partitions now: Postgres serves this size from btree indexes, and the daily delete is
  2,000–18,000 rows. Monthly `RANGE (created_at)` partitions with `DROP PARTITION` as the retention
  pay off past ~50 M rows or when the daily delete takes minutes; Prisma cannot declare them (a
  raw-SQL migration, partitions created ahead by the sweeper). ADR 0015 records the trigger and the
  path.
- Retention (⚑3): the legacy keeps 3 months. Recommended: `AUDIT_LOG_RETENTION_DAYS = 90`, a
  constant, not an env value, because the trigger (D7) holds the same number; changing it is a code
  change and a migration. Alternative: 1 year, common for security logs (about four times the sizes
  above).
- The sweeper, as the others: `QUEUE_NAMES.auditLogSweeper`,
  `apps/worker/src/schedulers/audit-log-sweeper.ts`,
  `upsertJobScheduler("audit-log-sweeper", { pattern: "0 4 * * *", tz: "Asia/Tokyo" }, { name: "sweep" })`
  (romuten-v3's time), concurrency 1. It deletes rows past the cut-off in batches of 1,000
  (`deleteOlderThan(cutoff, batch)`, raw SQL in the repository), then records one `SYSTEM` row
  `auditLog.purge` with the count; a second run the same day deletes and records nothing. No archive
  (the legacy had none); exporting a month to the bucket before deleting it is a later ticket if
  compliance asks.

### D7 ⚑ Append-only

- Application: the repository offers `create`, `createMany`, `findPage`, `findById`, `findHistory`
  and `deleteOlderThan` — no update, no delete by id; no procedure deletes.
- Database: the migration adds a trigger (plain SQL, as the role inserts are): `BEFORE UPDATE`
  raises; `BEFORE DELETE` raises unless `OLD.created_at < now() - interval '90 days'`. Prisma
  Studio, a script or a future bug cannot change or remove a young row; the sweeper's deletes pass.
  Tested on testcontainers.
- Not covered: the owner of the tables can drop the trigger; a runtime database role without DDL
  rights is a deployment follow-up (ADR 0015).
- The legacy delete (⚑4) — recommended: dropped (G2): no button, no procedure; catalog row 1504
  `AuditLog delete` stays (the seed never deletes a permission) but is granted to nobody and
  `visible = 0` in `permissions.csv` (the seed-test counts follow). Alternative: keep it for
  super_admin and record it — against append-only.

### D8 Coverage: no mutation forgotten

- `initTRPC.context<RequestContext>().meta<ProcedureMeta>()` with
  `ProcedureMeta = { audit?: false }` (a middleware reads it as `meta`).
- Exempt (`.meta({ audit: false })`), as in the legacy: `attachment.createUploadUrl` (legacy
  `generateUploadUrls` false; the file shows in its owner's change as 履歴書) and
  `commentTemplate.create / update / deleteMany` (legacy false; a user's own 定型文, ADR 0006).
- `apps/api/test/trpc/audit-coverage.test.ts`: every procedure of `appRouter._def.procedures` with
  `_def.type === "mutation"` is a key of `AUDIT_ACTIONS` or has `meta.audit === false`, never both;
  every procedure-shaped key of `AUDIT_ACTIONS` is a procedure (no stale key) — the legacy
  `AuditLogger` type and romuten-v3's map test.
- Each service's write test asserts its row (actor, action, target, changes). Rule changes, named so
  the approval covers them: `.claude/rules/module-template.md` (a write records its audit entries;
  an exempt mutation says why) and `.claude/rules/testing.md` (the audit assertion is a required
  test).

`AUDIT_ACTIONS` (labels after the routes' titles; the legacy names in the last column):

| Key                                                    | Label                                                                                | Legacy                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `user.invite`                                          | 担当者追加                                                                           | `createUser` ユーザー作成                                              |
| `user.update`                                          | 担当者情報編集                                                                       | `updateUser` ユーザー更新                                              |
| `user.updateProfile`                                   | プロフィール更新                                                                     | `profileUpdate` プロフィール更新                                       |
| `user.deactivate`, `user.reactivate`                   | 担当者利用停止, 担当者利用再開                                                       | `updateUserStatus` ユーザーステータス更新                              |
| `user.sendPasswordReset`                               | パスワード再設定メール送信                                                           | `sendResetPasswordLink` パスワードリセット                             |
| `staff.create`, `update`, `changeStatus`, `deleteMany` | スタッフ追加, スタッフ情報編集, スタッフステータス変更, スタッフ削除                 | スタッフ作成, 更新, ステータス更新, 削除                               |
| `client.*` (the same four)                             | クライアント追加, クライアント情報編集, クライアントステータス変更, クライアント削除 | クライアント作成, 更新, ステータス更新, 削除                           |
| `branch.*` (the same four)                             | 就業先部署追加, 就業先部署編集, 就業先部署ステータス変更, 就業先部署削除             | 支店作成, 更新, ステータス更新, 削除                                   |
| `csvImport.create`, `csvImport.confirm`                | CSVアップロード, CSVによる登録                                                       | `uploadSourceCsv` CSVアップロード, `createSourceCsv` CSVによる新規登録 |
| `csvExport.create`, `csvExport.downloadUrl`            | CSVダウンロード, CSV再ダウンロード                                                   | `download*Csv` ○○CSVダウンロード, `downloadCsvDownloadHistory`         |
| `auth.signIn`, `auth.signOut`                          | ログイン, ログアウト                                                                 | `login`, `logout`                                                      |
| `auth.changePassword`                                  | パスワード変更                                                                       | `changePassword`                                                       |
| `auth.requestPasswordReset`                            | パスワードを忘れた                                                                   | `forgotPassword`                                                       |
| `auth.resetPassword`                                   | パスワード設定                                                                       | `resetPassword` (not recorded: its args held the token)                |
| `auth.admin`                                           | 管理者API                                                                            | —                                                                      |
| `auditLog.purge`                                       | 保存期間切れログ削除                                                                 | —                                                                      |

### D9 Auth events: Better Auth hooks

- `/api/auth/*` is Better Auth's handler, not tRPC. `createAuth` (`packages/auth/src/server.ts`)
  takes an optional `onAuthEvent(event)` callback, as it takes `sendVerificationEmail`;
  `createAppAuth` (`apps/api/src/jobs/app-auth.ts`, used by both composition roots) implements it
  with the audit service, so `packages/auth` stays free of API code.
- Read in better-auth 1.7.3 (`dist/api/dispatch.mjs`): after-hooks also run when the endpoint threw
  an `APIError` (`context.returned` is then that error), and an error a hook throws that is not an
  `APIError` propagates — so the callback is wrapped in try / catch.
  - `/sign-in/email`: success → `ctx.context.newSession.user`; failure → the error's code
    (`INVALID_EMAIL_OR_PASSWORD`, `BANNED_USER`, `EMAIL_NOT_VERIFIED`), actor `ANONYMOUS` with the
    typed `email`.
  - `/sign-out` deletes the session before any after-hook runs (`dist/api/routes/sign-out.mjs`), so
    it is recorded in the `hooks.before` middleware (next to the password policy) from the session
    the request still carries.
  - `/change-password`; `/request-password-reset` (the typed address; the endpoint answers the same
    for unknown ones); `/reset-password` through the existing `onPasswordReset({ user })`;
    `/admin/*` (actor from the session, target `body.userId`).
  - Server-side calls (`ctx.auth.api.createUser` in `user.invite`, `requestPasswordReset` in
    `user.sendPasswordReset`) run the same hooks; the hook records only requests that came over HTTP
    (`ctx.request` set), as the calling service records its own action.
- IP: the Hono handler hands Better Auth a request carrying `clientIp(c)` in a header it always
  overwrites, named in Better Auth's `advanced.ipAddress.ipAddressHeaders` (present in 1.7.3), so
  the `sessions` rows and the log agree; the request id goes in as `x-request-id`.

### D10 ⚑ The list (「アクセスログ管理」)

- Route, title and menu exist (`routes.auditLog.list`, `/admin/master/log`, `read AuditLog`,
  ScrollText under マスター管理); the placeholder becomes `features/audit-log`, copied from
  `features/users` (skill feature-screen): container, table, toolbar, filter and filter content,
  labels and filter helpers, types.
- Columns: 日付, 時間, 担当者 (`SYSTEM` → システム; a failed sign-in → the typed
  address), アクション (badge), 対象 (type and label), ステータス (成功 / エラー). Dropped: the
  select column and 削除 (D7), the ID column (UUIDs mean nothing to a reader).
- Search: 担当者名・メールアドレス・対象 (legacy: ID, name, email, action name; the action moves to
  the filter).
- Filters (`FilterPopover`, fields through `next/dynamic`,
  `FilterTags`): アクション (`MultiOptionSelect` over `AUDIT_ACTIONS`; the legacy
  checkboxes), 対象 (`CheckboxGroup` over the entity
  types), ステータス (`CheckboxGroup`), 期間 (from – to). The period needs a standalone
  `DateRangePicker` in `packages/ui/src/components/composed/`, split out of the form's
  `DateRangeField`, which then wraps it — as `OptionSelect` and `SelectField`.
- Pagination (⚑5):
  - **Offset (recommended)** — `PageResult`, `DataTable` with its total badge and `PaginationBar`
    (<< < pages > >> and the page box), as every list here and the legacy; with 90 days kept the
    table stays under ~1.6 M rows: a `count` under a filter on an indexed column takes tens of
    milliseconds, an unfiltered one a few hundred at most. romuten-v3's audit list is offset as well
    (`AuditLogsContainer`: `page`, `pageSize`).
  - **Cursor** (the brief's word) — keyset on `(created_at, id)`: constant time at any depth, no row
    repeats or slips while new rows arrive; but no page numbers, no jump box, no total, and
    `DataTable` / `PaginationBar` need a cursor mode (a `packages/ui` change). It pays off at tens
    of millions of rows.
  - The entity history (D12) is a feed and uses a cursor (もっと見る) either way.

### D11 The detail

- `AuditLogDetailDialog` — a `ResponsiveDialog` loaded with `next/dynamic`, rendered only for a
  chosen row; its data from `auditLog.byId` (the list rows carry no `changes`, so the page stays
  light). Sections after romuten-v3
  `AuditLogDetailDialog.tsx`: 実行者 (名前, メールアドレス, 権限), 操作内容 (日時, アクション, 対象, ステータス, エラーコード), 変更内容, 実行環境 (IPアドレス, ブラウザ, リクエストID).
- 変更内容 is `AuditChanges`: 項目 / 変更前 / 変更後, labels from
  `AUDIT_FIELDS`, 「変更あり（非表示）」for a masked field, 「—」 for nothing; shared with the
  history (two consumers in one feature, so it stays in the feature).
- The legacy had no detail; this is the brief's.

### D12 ⚑ Entity history (「変更履歴」)

- One container in `features/audit-log` — `AuditHistory` with `{ entityType, entityId }` — over
  `auditLog.history` (cursor, 20 at a time, もっと見る): each entry
  shows 日時, 担当者, アクション and opens into `AuditChanges`.
- Placement (⚑6):
  - **Recommended:** a 「変更履歴」 button in the detail header beside 編集, opening the history in
    a `ResponsiveDialog`. The four pages keep their legacy layout (cards side by side; no detail
    page has tabs, here or in the legacy), the history loads only when asked for
    (`.claude/rules/ui.md`, load only what the page shows), and each page hands the button to its
    container as a slot (`history={<AuditHistoryButton entityType="Client" entityId={id} />}`), as
    it hands in 就業先部署 and 担当スタッフ today.
  - **Tabs** (the brief's word): a `Tabs` primitive (shadcn `tabs`, new in `packages/ui`)
    and 基本情報 / 変更履歴 on the four pages — every detail layout changes.
- Pages: 担当者 (`/admin/master/user/[id]`), スタッフ, クライアント, 就業先部署. Shown inside
  `<Can I="read" a="AuditLog">`; the procedure checks the same.

### D13 Mobile

- Responsive already: `FilterPopover` (a bottom drawer below `md`), `ResponsiveDialog` (detail,
  history), the list's table scrolling sideways as the other lists — the legacy `ResponsiveOverlay`.
- Left for the mobile ticket: `AuditChanges` stacks each field (項目 above 変更前 → 変更後) below
  `sm`; the period picker shows one month in the drawer; a 375 px pass over list, detail and
  history.

### D14 ⚑ Who reads

- Catalog row 1502 `AuditLog read` stays as it is: super_admin and admin (the legacy SUPER_ADMIN and
  ADMIN). Manager and AM get no menu, the 403 page, `FORBIDDEN` from the procedures and
  no「変更履歴」 button.
- Own rows only (⚑7) — recommended: no; the legacy shows every row to the two admin roles and nobody
  else has a screen. Alternative: everyone reads their own rows
  (`can("read", "AuditLog", { actorId: user.id })` after the grant loop, a 操作履歴 page
  under プロフィール) — a screen neither the legacy nor the brief's list asks for.
- The history needs `read AuditLog`, not the entity's `read`: it shows actors, addresses and
  failures. Rows are not filtered by entity type: the admin roles hold every read grant, and `DENY`
  rows exist for managers only (`OVERRIDABLE_ROLES`).
- Procedures `auditLog.list`, `auditLog.byId` and `auditLog.history`, each
  `requireAbility("read", "AuditLog")`; the service checks `canUnscoped` again.

### Open questions (answer by number)

1. **D1** — rows written in the service's transaction, failures by a tRPC middleware, auth events by
   Better Auth hooks. Recommended: yes.
2. **D4** — mask the personal fields listed in D4 (changed, value hidden). Recommended: yes, as the
   brief asks.
3. **D6** — keep 90 days, as the legacy. Recommended: 90.
4. **D7** — drop the legacy delete; row 1504 granted to nobody and hidden. Recommended: yes.
5. **D10** — offset pagination with the legacy `PaginationBar`, or cursor. Recommended: offset (the
   history uses a cursor either way).
6. **D12** — a 「変更履歴」 button with a dialog, or tabs. Recommended: the button.
7. **D14** — the two admin roles read every row; nobody reads only their own. Recommended: yes.
8. Order: the Backlog below follows the brief's stages (schema → writing → masking → API → web list
   and detail → history → mobile). Recommended: as listed.

## Legacy → new (screens)

| Legacy (`d-round-web`)                                                                                        | New                                                                             | Kept / changed / dropped                 |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `app/admin/master/log/page.tsx`: `<Can I="read" an="Admin_Log">`                                              | `PageGuard` on `routes.auditLog.list` (`read AuditLog`), title アクセスログ管理 | kept                                     |
| `AuditLogsToolbar`: `SearchInput` 「検索」 over ID, 担当者, メール, アクション名                              | `SearchInput` over 担当者名, メールアドレス, 対象                               | changed: no ID, the action in the filter |
| `AuditLogFilter` (`ResponsiveOverlay`) → アクション checkboxes from the `auditLogActions` query               | `FilterPopover`: アクション, 対象, ステータス, 期間, from `@repo/validation`    | changed (brief)                          |
| 削除 in the toolbar, 「ログを削除しますか？」, row checkboxes, the `rowSelection` store, `useDeleteAuditLogs` | —                                                                               | dropped (D7)                             |
| columns ☑, ID, 担当者, 日付 (YYYY/MM/DD), 時間 (HH:mm), アクション (badge), ステータス (成功 / エラー)        | 日付, 時間, 担当者, アクション, 対象, ステータス                                | ☑ and ID dropped, 対象 added (brief)     |
| offset pagination (`page`, `size`, 10 a page)                                                                 | ⚑5; 20 a page, as every list here                                               | ⚑                                        |
| no detail; `metadata` never shown                                                                             | 「詳細」 dialog with 変更内容                                                   | added (brief)                            |
| —                                                                                                             | 「変更履歴」 on four detail pages                                               | added (brief)                            |

## Out of scope

Reads are not recorded (the legacy recorded mutations only; downloads are recorded); exporting old
rows to the bucket; partitions (D6); a separate database role (D7); importing the legacy MySQL
`AuditLog` rows — they hold passwords and tokens (G1), so they must not be copied, and the legacy
table should be emptied when the legacy app retires; alerts on suspicious patterns (many failed
sign-ins); the workflow screens' actions (the coverage test makes their port declare them); the
`/queues` dashboard.

## Risks

- **R1** — a write path that forgets `recordChanges`: the coverage test proves the declaration, not
  the call; the per-service tests and the module-template rule cover the call.
- **R2** — a Better Auth upgrade changes the behaviour D9 relies on (after-hooks on an `APIError`,
  `newSession`, sign-out's order): the auth-event tests pin it; ADR 0015 names the files read.
- **R3** — `x-forwarded-for` can be forged unless the load balancer overwrites it: the IP column is
  as trustworthy as the rate limiter's (`docs/auth.md`).
- **R4** — a view builder that throws would fail the write it records: builders are total and are
  tested with minimal rows.
- **R5** — growth above the estimate: the purge row shows the daily count; D6 names the partition
  path.
- **R6** — the trigger holds 90 days: a shorter retention needs a migration (deliberately).

## (c) Backlog

Assumptions for the dates: one developer, about one ticket per working day, starting Thursday
2026-10-15; the user corrects them for the real team. Every ticket is 1–3 points (the Backlog rule:
5 and up are split). One branch for the epic (`feature/D_ROUND-TBD_audit-log`), each ticket one or
more commits named after it, as in the CSV epic; a ticket's file-level steps are written when it
starts.

| #   | Stage     | Title                                                                 | Pt  | Date  | Depends on     |
| --- | --------- | --------------------------------------------------------------------- | --- | ----- | -------------- |
| T1  | 1 Schema  | Audit log: table, indexes, append-only trigger and ADR                | 3   | 10/15 | ⚑3             |
| T2  | 2 Writing | Audit log: request data, change recorder, failure rows, coverage test | 3   | 10/16 | T1, ⚑1         |
| T3  | 2 Writing | Audit log: sign-in, sign-out and password events from Better Auth     | 3   | 10/19 | T2             |
| T4  | 2 Writing | Audit log: retention sweeper in the worker                            | 2   | 10/20 | T1             |
| T5  | 3 Masking | Audit log: audit views, field registry and masking                    | 3   | 10/21 | T2, ⚑2         |
| T6  | 3 Masking | Audit log: user writes record their changes                           | 2   | 10/22 | T5             |
| T7  | 3 Masking | Audit log: staff, client and branch writes record their changes       | 3   | 10/23 | T5             |
| T8  | 3 Masking | Audit log: CSV imports and downloads                                  | 1   | 10/26 | T6, T7         |
| T9  | 4 API     | Audit log: list, detail and history procedures                        | 2   | 10/26 | T2, ⚑4, ⚑5, ⚑7 |
| T10 | 5 Web     | UI: standalone date range picker                                      | 2   | 10/27 | —              |
| T11 | 5 Web     | Audit log UI: list screen with search and filters                     | 3   | 10/28 | T9, T10        |
| T12 | 5 Web     | Audit log UI: detail dialog with the change table                     | 2   | 10/29 | T11            |
| T13 | 6 History | Audit log UI: change history on four detail pages                     | 3   | 10/30 | T12, ⚑6        |
| T14 | 7 Mobile  | Audit log UI: mobile layout                                           | 1   | 11/02 | T11–T13        |
|     |           | **Total**                                                             | 33  |       |                |

### T1 · Audit log: table, indexes, append-only trigger and ADR — 3 pt

- Dates: 2026-10-15 – 2026-10-15. Depends on: open question 3.
- Requirement (functional): table `audit_logs` with the enums of D2 and the trigger of D7; a
  repository with `create`, `createMany`, `findPage`, `findById`, `findHistory` (cursor) and
  `deleteOlderThan`; `packages/validation/src/audit-log.schema.ts` with `AUDIT_ENTITY_TYPES`,
  `AUDIT_LOG_RETENTION_DAYS` and the input schemas (`AUDIT_ACTIONS` filled in T2).
- Requirement (non-functional): an expand-only migration; the five indexes; ADR 0015 (D1–D14);
  `.claude/rules/migrations.md` (folder list, migrations table, the `Json` and trigger exceptions).
- Plan: `packages/database/prisma/schema/audit/audit-log.prisma`, the migration
  `<timestamp>_add_audit_logs`, `packages/database/src/repositories/audit-log.repository.ts`,
  `packages/database/src/{repositories/index,index}.ts`,
  `packages/validation/src/{audit-log.schema,index}.ts`, `docs/adr/0015-audit-log.md`,
  `.claude/rules/migrations.md`. Tests (testcontainers): `createMany`, then `findPage` newest first
  under every filter; `findHistory` pages by cursor; `deleteOlderThan` removes only old rows, in
  batches; an `UPDATE` and the `DELETE` of a young row raise; the drift gate stays clean.
- Description (JP): アクセスログのテーブル、インデックス、改ざん防止のトリガーとADRを追加する。
- Description (MN): Хандалтын логийн хүснэгт, индекс, өөрчлөлтөөс хамгаалах trigger болон ADR-ийг
  нэмнэ.

### T2 · Audit log: request data, change recorder, failure rows, coverage test — 3 pt

- Dates: 2026-10-16 – 2026-10-16. Depends on: T1, open question 1.
- Requirement (functional): `RequestContext.ipAddress` and `userAgent` (the Hono layer passes
  `clientIp(c)`; jobs leave them null); `audit-log.service.ts` with
  `recordChanges(ctx, db, entries)` (the actor snapshot, `diffViews(before, after)`, the 16 kB cap)
  and `recordFailure`; `meta<ProcedureMeta>()` and `auditFailures` in `protectedProcedure`;
  `AUDIT_ACTIONS` for every current mutation and `.meta({ audit: false })` on the four exempt ones;
  the coverage test.
- Requirement (non-functional): a failure row never changes a response (its own error is logged); no
  input or result is stored.
- Plan: `apps/api/src/core/context.ts`, `apps/api/src/app.ts`, `apps/api/src/trpc/init.ts`,
  `apps/api/src/trpc/routers/{attachment,comment-template}.router.ts`,
  `apps/api/src/modules/audit-log/audit-log.service.ts`,
  `packages/validation/src/audit-log.schema.ts`, `.claude/rules/{module-template,testing}.md`, the
  hand-built contexts in the API tests. Tests: a forbidden and a conflicting mutation each leave one
  `FAILURE` row with their code and answer as before; an INSERT error in `auditFailures` leaves the
  response unchanged and is logged; queries and exempt mutations record nothing; the coverage test
  fails for an unlisted mutation (a fixture router); `recordChanges` inside a rolled-back
  transaction leaves nothing.
- Description
  (JP): リクエスト情報の取得、変更と失敗の記録、全ミューテーションの記録漏れを検出するテストを追加する。
- Description (MN): Хүсэлтийн мэдээлэл, өөрчлөлт болон алдаатай хүсэлтийг бүртгэх механизм, бүх
  mutation бүртгэгдсэн эсэхийг шалгах тестийг нэмнэ.

### T3 · Audit log: sign-in, sign-out and password events from Better Auth — 3 pt

- Dates: 2026-10-19 – 2026-10-19. Depends on: T2.
- Requirement (functional): `createAuth({ onAuthEvent })`; the `hooks.before` middleware records
  sign-out next to the password policy; `hooks.after` records sign-in, change-password,
  request-password-reset and `/admin/*`; `onPasswordReset` records the reset; HTTP calls only;
  `createAppAuth` implements the callback; the Hono handler passes the client IP header and the
  request id into Better Auth's request.
- Requirement (non-functional): Better Auth's answers are unchanged when recording fails; no
  password or token is read.
- Plan: `packages/auth/src/server.ts`, `apps/api/src/jobs/app-auth.ts`, `apps/api/src/app.ts`,
  `apps/api/src/modules/audit-log/audit-log.service.ts`, `docs/auth.md`. Tests
  (`apps/api/test/auth-http.test.ts`): sign-in success, and a wrong password (`ANONYMOUS`, the typed
  address, the code); sign-out (the actor); change-password; forgot password (an unknown address is
  recorded the same way); reset through the link; `admin/set-role` over HTTP; `user.invite` leaves
  no `auth.*` row; a failing recorder leaves the response identical.
- Description (JP): ログイン・ログアウト・パスワード変更などの認証イベントを記録する。
- Description (MN): Нэвтрэх, гарах, нууц үг солих зэрэг нэвтрэлтийн үйлдлүүдийг бүртгэнэ.

### T4 · Audit log: retention sweeper in the worker — 2 pt

- Dates: 2026-10-20 – 2026-10-20. Depends on: T1.
- Requirement (functional): `QUEUE_NAMES.auditLogSweeper`;
  `apps/worker/src/schedulers/audit-log-sweeper.ts` with `sweepAuditLogs`, `registerAuditLogSweeper`
  (04:00 Asia/Tokyo) and `createAuditLogSweeperWorker`, registered in `apps/worker/src/index.ts`;
  one `SYSTEM` row `auditLog.purge` with the count when rows were deleted.
- Requirement (non-functional): batches of 1,000; idempotent; the queue rules.
- Plan: `packages/queue/src/names.ts`, `apps/worker/src/schedulers/audit-log-sweeper.ts`,
  `apps/worker/src/index.ts`, `.claude/rules/queue.md`. Tests (testcontainers): only rows past the
  cut-off go, in batches; one purge row with the count; a second run deletes and records nothing;
  the scheduler upsert is idempotent.
- Description (JP): 保存期間を過ぎたアクセスログを毎日削除するジョブを追加する。
- Description (MN): Хадгалах хугацаа өнгөрсөн логийг өдөр бүр устгах job нэмнэ.

### T5 · Audit log: audit views, field registry and masking — 3 pt

- Dates: 2026-10-21 – 2026-10-21. Depends on: T2, open question 2.
- Requirement (functional): `AUDIT_FIELDS` per entity type (key, label — the `*_EXPORT_FIELDS`
  header or the extra field's —, `masked`); the views of D3
  for 担当者, スタッフ, クライアント and 就業先部署 over the download cells; masking in `diffViews`.
- Requirement (non-functional): views never throw; every label has one home (no copied label map).
- Plan: `packages/validation/src/audit-log.schema.ts`,
  `apps/api/src/modules/audit-log/audit-views.ts`,
  `apps/api/src/modules/csv-export/csv-exporters.ts` (exports only). Tests: each view's keys equal
  its registry; every field of the create schemas has a view field; a masked field carries no
  values; a minimal row (no address, no relations) builds; the cap cuts and marks.
- Description (JP): 変更前後の比較に使う項目定義と、個人情報項目のマスキングを追加する。
- Description (MN): Өмнө/дараах харьцуулалтад ашиглах талбарын тодорхойлолт болон хувийн мэдээллийн
  талбарыг нуух (mask) логикийг нэмнэ.

### T6 · Audit log: user writes record their changes — 2 pt

- Dates: 2026-10-22 – 2026-10-22. Depends on: T5.
- Requirement (functional): `user.invite`, `update`, `updateProfile`, `deactivate`, `reactivate` and
  `sendPasswordReset` record their rows in their transactions (role and overrides included).
- Requirement (non-functional): no extra query for the before.
- Plan: `apps/api/src/modules/user/user.service.ts`, `apps/api/test/modules/user/*.test.ts`. Tests
  per function: the row's actor, action, target and changes; a refused update leaves only its
  failure row.
- Description
  (JP): 担当者の追加・編集・利用停止・利用再開・プロフィール更新・パスワード再設定メール送信を記録する。
- Description (MN): 担当者 (хэрэглэгч)-ийн нэмэх, засах, түр зогсоох, сэргээх, профайл шинэчлэх,
  нууц үг сэргээх мэйл илгээх үйлдлүүдийг бүртгэнэ.

### T7 · Audit log: staff, client and branch writes record their changes — 3 pt

- Dates: 2026-10-23 – 2026-10-23. Depends on: T5.
- Requirement (functional): `create`, `update`, `changeStatus` and `removeMany` of the staff, client
  and branch services; `removeMany` records one row per entity (`createMany`), its `findStatuses`
  selecting the label columns.
- Requirement (non-functional): no extra query for the before.
- Plan: `apps/api/src/modules/{staff,client,branch}/*.service.ts`,
  `packages/database/src/repositories/{staff,client,branch}.repository.ts` (label columns), tests in
  `apps/api/test/modules/{staff,client,branch}/`. Tests: a create lists the filled fields, an update
  the changed ones only, a status change the ステータス, a delete one row per id with its label.
- Description (JP): スタッフ・クライアント・就業先部署の追加・編集・ステータス変更・削除を記録する。
- Description (MN): スタッフ, クライアント, 就業先部署-ийн нэмэх, засах, төлөв өөрчлөх, устгах
  үйлдлүүдийг бүртгэнэ.

### T8 · Audit log: CSV imports and downloads — 1 pt

- Dates: 2026-10-26 – 2026-10-26. Depends on: T6, T7.
- Requirement (functional): `csvImport.create` (type, file name), `csvImport.confirm` (the selected
  lines), `csvExport.create` (type, row count, columns), `csvExport.downloadUrl` (re-download); the
  imported entities through their services, with the uploader and the confirm's request id.
- Requirement (non-functional): no file content and no download URL in a row.
- Plan: `apps/api/src/modules/{csv-import,csv-export}/*.service.ts`, their tests. Tests: an import
  of two lines leaves the upload, the confirmation and two `client.create` rows sharing the request
  id, with the uploader as actor; a download records its row without the file.
- Description (JP): CSVのアップロード・取込確定・ダウンロード（再ダウンロードを含む）を記録する。
- Description (MN): CSV upload, импорт баталгаажуулалт, татах (дахин татахыг оруулаад) үйлдлүүдийг
  бүртгэнэ.

### T9 · Audit log: list, detail and history procedures — 2 pt

- Dates: 2026-10-26 – 2026-10-26. Depends on: T2, open questions 4, 5 and 7.
- Requirement (functional): `auditLog.list` (search, actions, entity types, statuses, period, page),
  `auditLog.byId`, `auditLog.history` (cursor); catalog row 1504 granted to nobody, `visible = 0`.
- Requirement (non-functional): `requireAbility("read", "AuditLog")` and `canUnscoped`; list rows
  without `changes`.
- Plan: `apps/api/src/trpc/routers/audit-log.router.ts`, `apps/api/src/trpc/router.ts`,
  `apps/api/src/modules/audit-log/audit-log.service.ts`,
  `packages/database/prisma/seed/data/permissions.csv` and the seed tests,
  `.claude/rules/permissions.md`. Tests: an admin lists newest first under each filter; manager and
  AM get `FORBIDDEN`; the history pages by cursor; the catalog test with row 1504 granted to nobody.
- Description (JP): アクセスログの一覧・詳細・変更履歴を取得するAPIを追加する。
- Description (MN): Логийн жагсаалт, дэлгэрэнгүй, өөрчлөлтийн түүхийг авах API нэмнэ.

### T10 · UI: standalone date range picker — 2 pt

- Dates: 2026-10-27 – 2026-10-27. Depends on: —.
- Requirement (functional): `DateRangePicker` (`value` `{ from, to }`, `onValueChange`, a label, the
  legacy calendar with << and >>); `DateRangeField` wraps it.
- Requirement (non-functional): domain-free, English defaults, a jsdom test.
- Plan: `packages/ui/src/components/composed/date-range-picker.tsx`,
  `packages/ui/src/components/form/date-range-field.tsx`, the composed README,
  `.claude/rules/ui.md`. Tests: choosing a range, clearing it, the field still passing its tests.
- Description (JP): 期間で絞り込むための日付範囲選択コンポーネントを追加する。
- Description (MN): Хугацаагаар шүүх огнооны муж сонгох component нэмнэ.

### T11 · Audit log UI: list screen with search and filters — 3 pt

- Dates: 2026-10-28 – 2026-10-28. Depends on: T9, T10.
- Requirement (functional): D10 and the Legacy → new table.
- Requirement (non-functional): the filter fields and dialogs load with `next/dynamic`; the state in
  the URL.
- Plan: `apps/web/app/admin/master/log/page.tsx`,
  `apps/web/features/audit-log/{containers/audit-logs-container.tsx,components/list/*.tsx,utils/{audit-log-labels,audit-log-filters}.ts,types.ts}`.
  Tests: filters to and from the URL; labels; a `SYSTEM` and an `ANONYMOUS` row render; browser
  check as super_admin, admin and manager (403) next to the legacy screen.
- Description (JP): アクセスログ管理画面（一覧・検索・絞り込み）を作成する。
- Description (MN): Хандалтын лог удирдах дэлгэц (жагсаалт, хайлт, шүүлт)-ийг хийнэ.

### T12 · Audit log UI: detail dialog with the change table — 2 pt

- Dates: 2026-10-29 – 2026-10-29. Depends on: T11.
- Requirement (functional): D11.
- Requirement (non-functional): the dialog renders only for a chosen row; its query runs only then.
- Plan: `apps/web/features/audit-log/components/detail/{audit-log-detail-dialog,audit-changes}.tsx`,
  the container. Tests: the sections; a masked field; a create (no before); a failure row (the code,
  no changes).
- Description (JP): アクセスログの詳細（変更前後の比較表）を表示するダイアログを作成する。
- Description (MN): Логийн дэлгэрэнгүй (өмнө/дараах харьцуулсан хүснэгт)-ийг харуулах dialog хийнэ.

### T13 · Audit log UI: change history on four detail pages — 3 pt

- Dates: 2026-10-30 – 2026-10-30. Depends on: T12, open question 6.
- Requirement (functional): D12 on the 担当者, スタッフ, クライアント and 就業先部署 detail pages.
- Requirement (non-functional): nothing loads until the button is pressed; hidden without
  `read AuditLog`.
- Plan:
  `apps/web/features/audit-log/{containers/audit-history-container.tsx,components/history/*.tsx}`,
  the four detail containers (a `history` slot) and their pages, `.claude/rules/ui.md`.
  Tests: もっと見る loads the next entries; the button is hidden without the grant; browser check of
  the four pages as admin and manager.
- Description (JP): 担当者・スタッフ・クライアント・就業先部署の詳細画面に変更履歴を追加する。
- Description (MN): 担当者, スタッフ, クライアント, 就業先部署-ийн дэлгэрэнгүй дэлгэцэнд өөрчлөлтийн
  түүхийг нэмнэ.

### T14 · Audit log UI: mobile layout — 1 pt

- Dates: 2026-11-02 – 2026-11-02. Depends on: T11–T13.
- Requirement (functional): D13 — the changes stacked below `sm`, a one-month picker in the drawer.
- Requirement (non-functional): every screen usable at 375 px.
- Plan: `audit-changes.tsx`, `audit-log-filter-content.tsx`; jsdom tests with `matchMedia` stubbed;
  browser check at 375 px.
- Description (JP): アクセスログの一覧・詳細・変更履歴をスマートフォン表示に対応させる。
- Description (MN): Логийн жагсаалт, дэлгэрэнгүй, өөрчлөлтийн түүхийг гар утсанд тохируулна.

## Log

- 2026-10-14 — draft written (phase 2 of the brief); waiting for the answers to the open questions.
- 2026-10-14 — approved by the user ("ok heregjuul"): every open question takes its recommended
  answer (1 rows in the service's transaction, failures by middleware, auth events by Better Auth
  hooks; 2 the listed personal fields masked; 3 90 days; 4 the legacy delete dropped, row 1504
  granted to nobody and hidden; 5 offset pagination, the history by cursor; 6 a 「変更履歴」 button
  with a dialog; 7 the two admin roles read every row; 8 the stage order). One branch for the epic;
  each ticket is one or more commits named after it. The orchestrator implements the tickets itself
  (as in the CSV epic) and runs the verifier and the reviewer per MR.
- 2026-10-14 — amendments while building T1–T9 (each commit verify 43/43; T1's run had a
  testcontainers port timeout in the worker tests under load, green alone):
  - T1 holds the schema, the trigger and the repository; `AUDIT_ACTIONS` came with T2 and the input
    schemas with T9, where they are used. The trigger raises the default `P0001`: with
    `restrict_violation` Prisma reported a foreign-key error and lost the message.
  - D3: the cap is per value (500 characters, the entry marked `truncated`), not 16 kB per row.
  - The purge's action key is `system.auditLogPurge` (Better Auth's are `auth.*`, the system's
    `system.*`; the coverage test skips both).
  - T3: as planned; a failed sign-in records `INVALID_EMAIL_OR_PASSWORD` with the typed address.
  - T5: `ROLE_LABELS` and `STAFF_MEMO_TYPE_LABELS` moved to `@repo/validation` (the web re-exports
    them); the 就業先部署's メモ joined its view; the プロフィール画像 is not audited.
  - T6: an edit of a 担当者 reads its overrides before and after and the catalog's names (three
    queries, rare admin writes); an invitation reads the user back in its transaction.
  - T7: a status change runs in one transaction with its row; a status set to the one it had records
    a row without fields.
  - T8: a CSV type is named from the entity's name (`担当者 追加`); a re-download from 履歴 is
    recorded when its button asks for the URL (an imperative query, never refetched).
- 2026-10-14 — amendments while building T9–T14 (each commit verify 43/43):
  - T4 / D6: `deleteOlderThan` reads the ids of the oldest rows past the cut-off and deletes them
    with Prisma (`findMany` + `deleteMany`), not raw SQL: the same two statements, typed.
  - T9: the history leaves out sign-ins and sign-outs (`NOT_CHANGES`): they change nothing,
    and アクセスログ管理 lists them.
  - T10: the picker closes on the second pick since it opened (react-day-picker 10 makes the first
    pick a one-day range, so the old `DateRangeField` closed after one click).
  - T13: the plan's `audit-history-container.tsx` is `containers/audit-history-button.tsx` (the
    button and its dialog; a route imports containers only).
  - T14: the changes stack below `md` (`useIsMobile`, where the dialogs become drawers), not `sm`.
- 2026-10-14 — MR checks: verifier PASS (fresh verify 43/43, 0 cached; drift gate clean; migrate
  status up to date, both triggers present). Reviewer REQUEST_CHANGES (2 BLOCKER, 4 SHOULD, 7 NIT);
  security review 1 HIGH, 1 MEDIUM, 2 LOW. Fix round 1, each commit verify 43/43:
  - The hooks keep a typed address, `userId` and `role` only when `emailSchema`, `idSchema` and
    `roleSchema` parse them (BLOCKER, HIGH; arrays of roles joined, LOW); a body over 64 KB below
    `/api/auth` gets 413 before Better Auth reads it (HIGH); a row keeps the address only when
    `isIP` accepts it (LOW). The columns get no new caps: the migration is applied in the dev
    database and is not edited, and every writer now bounds its values. The target lookup is not
    caught apart (LOW): with the id parsed it fails only when the database does, and the insert with
    it.
  - Impersonation (MEDIUM): the admin roles keep `adminAc` without `impersonate`; nothing in the web
    used it, and with no role able to impersonate the `/admin/*` actor needs no other source.
  - `/update-user` (SHOULD, the reviewer left the choice open): disabled, not recorded — the web
    never calls it and renames through `user.updateProfile`, which validates and records.
  - `csvExport.downloadUrl` is a mutation (SHOULD): a GET wrote a row, and its failures went
    unrecorded. The 履歴 dialog calls it with `mutationOptions`.
  - Tests: `findStatuses` asserts whole rows again (BLOCKER); each view builds from a bare row; the
    failure middleware's log line is asserted. Stacked changes use `DescriptionList` (SHOULD).
  - NIT: case-insensitive search on every field; the list selects only its columns; `roleLabelOf`
    lives in `@repo/validation`; ADR 0015 and module-template.md name the extra queries and the
    `recordAuthEvent` exception. Left: the first X-Forwarded-For entry as the client's address
    predates this MR (the rate limiter keys on it too) — the trusted proxy hop is a deployment
    ticket.
- 2026-10-14 — round 1 browser-checked (API 4001 / web 3001 on the dev database): the list, a
  case-insensitive search, the detail and a client's 変更履歴 as super_admin and admin on a desktop
  and at 375 px (the stacked changes as a `DescriptionList`, no sideways scroll); a CSV re-download
  from 「CSVダウンロード履歴」 as admin (`POST` 200, the workbook saved; super_admin and manager
  hold no download of their own); manager and AM get the 403 page. Re-review: 0 BLOCKER, 3 SHOULD, 4
  NIT. Fix round 2 (verify 43/43):
  - Round 1's "every writer bounds its values" had two gaps: a role array had no upper bound (now at
    most `ROLES.length`), and `isIP` takes an IPv6 zone index of any length (a row now refuses `%`
    and more than 45 characters). An `/admin/*` or `/change-password` call without a session is no
    longer recorded, as a tRPC call without one is not.
  - An `auth.admin` row's target is the parsed `userId` only: the caller is no longer the target of
    its own refused or `create-user` call.
  - The stacked 変更後 says （一部省略） for a cut value cleared to nothing, as the table does.
  - Docs: ADR 0003 and permissions.md name the role map without `impersonate`; ADR 0015 names the
    two closed paths and what stays unrecorded; two stale comments.

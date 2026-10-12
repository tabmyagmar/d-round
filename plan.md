# Plan: CSV import / export — the legacy CSV feature on BullMQ (epic)

Branch: `feature/D_ROUND-TBD_csv-import`. Status: **draft 2026-10-12, awaiting approval**. Phase 1
(the legacy sequence) was explained in chat on 2026-10-09; this plan is phase 2: (a) the flow
comparison, (b) the architecture decisions, (c) the Backlog tickets. Decisions marked **⚑** need the
user's answer; each names its reference. The upload infrastructure is taken as given: PR #2
(`attachments`, `@repo/storage`, ADR 0012), merged into develop as `9182870`. It is not the
`tmp → finalize` + `SourceFile` design the brief names: ADR 0012 rejected that (an `attachments` row
goes `PENDING → ATTACHED` inside the owner's write, objects never move), and this plan uses what was
built.

Read before this plan — legacy API (`../d-round-api`, develop 2026-10-05): `src/jobs/index.ts`,
`src/jobs/csv/upload/{index,upload,create}.ts`, `src/jobs/csv/upload/{user,staff,client,branch}/**`,
`src/jobs/utils/{validator,types,source}.ts`, `src/graphql/resolvers/csv/{upload,download}/*.ts`,
`src/graphql/resolvers/csv/helpers.ts`, `src/graphql/schema/{source,csv-download}.ts`,
`src/database/schema/source/sourceCsv.prisma`, `src/utils/google-storage/*.ts`,
`src/utils/casl/permissions/*.ts`, `.env.example` (`RUN_CRON`, `CSV_*_CRON_SCHEDULE`); legacy web
(`../d-round-web`): `src/shared/components/csv/**` (`common/CsvMenuDialog`, `CsvUpload`,
`CsvUploadError`, `CsvUploadHistoryStatus`, `upload/*`, `update/*`, `history/*`, `download/*`,
`schema/**`, `utils/{validator,titleMap,fileMap,enums,downloadFile}.ts`),
`src/shared/components/content/Toolbar.tsx`, `src/features/*/components/list/*Toolbar.tsx`,
`public/csv/{template,manual}/**`; romuten-v3 (`../../romuten/v3/romuten-v3`):
`apps/backend/src/lib/bullmq/{queues,workers,schedules,constants}/sourceCsv.*`,
`apps/backend/src/jobs/sourceCsv/**`, `apps/backend/src/modules/sourceCsv/csv.{service,schema}.ts`,
`apps/web/src/features/sourceCsv/**`, `packages/constants/src/source-csv-constants.ts`; this repo:
`.claude/rules/{queue,layers,permissions,ui}.md`, `docs/adr/0004-outbox.md`,
`docs/adr/0012-attachments.md`, `docs/attachments.md`, `packages/queue/src/**`,
`apps/worker/src/{index.ts,processors/*,schedulers/*}`,
`apps/api/src/modules/attachment/attachment.service.ts`, `apps/web/hooks/use-attachment-upload.ts`,
`packages/ui/src/components/composed/{filter-popover,content-dialog,stepper,data-table}.tsx`,
`apps/web/features/users/components/list/users-toolbar.tsx` (the CSV TODO).

## Goal and acceptance criteria

Port the legacy CSV import (追加 / 更新 for 担当者, スタッフ, クライアント, 就業先部署) and the CSV
download with their history, replacing the two cron ticks with BullMQ jobs, and close the legacy
gaps listed under (a).

- A list toolbar (担当者管理, スタッフ管理, クライアント管理, 就業先部署管理) has one 「CSV」 menu:
  {label}を追加, {label}を更新, ダウンロード, 履歴 — each item shown by ability.
- 追加 / 更新 open one dialog with four steps — ファイル選択 → 内容確認 → 登録 → 結果 — that follows
  the import's status by itself (no "close and come back in 5 minutes"); reopening an import
  from 履歴 lands on its step.
- A file in UTF-8 (with or without BOM) or Shift_JIS is read the same; format errors show at once in
  the browser with their CSV line; the server checks the stored file again and adds database checks
  (already registered, unknown 地域, inactive 担当者, missing update target).
- Only rows that passed the check can be confirmed; each confirmed row is imported on its own (one
  failing row does not undo the others) and reports its result; an error CSV (original
  columns + 行番号 + エラー内容) is downloadable for every type.
- A worker crash, a Redis flush or a lost job never leaves an import stuck: it is resumed (check) or
  marked failed with a reason (import).
- History per type: who, when, file, counts (取込データ / 取込可能 / 取込不可 / 登録), status,
  action.
- Below `md` every CSV dialog and the menu open as bottom drawers (the `FilterPopover` pattern).
- Every procedure has `requireAbility`; queue rules hold (ID-only payloads, enqueue after commit,
  deterministic jobIds, idempotent processors, DB row is truth); `yarn verify` green per commit;
  every screen browser-checked as each role it serves next to the legacy screen.

## (a) Flow comparison

### Legacy, as built

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API (GraphQL)
    participant G as Cloud Storage
    participant C as Cron (inside the API process)
    participant DB as MySQL
    B->>B: papaparse + zod: format, in-file duplicates (5 MB, < 150 rows)
    B->>A: generateUploadUrls → SourceFile row + signed PUT URL
    B->>G: PUT file (never read again; fileKey is ignored)
    B->>A: uploadSourceCsv {type, fileName, rows as JSON}
    A->>DB: SourceCsvHistory UPLOADED + SourceCsvHistoryData.fileUpload
    Note over C: odd minutes (1-59/2), every UPLOADED row at once (Promise.all), no claim
    C->>DB: *-check.ts: DB lookups + validators → CHECK_SUCCESS | CHECK_ERROR, fileChecked
    Note over B: toast: close, reopen 履歴 after ~5 min
    B->>A: 登録 → select valid rows → createSourceCsv {id, rows from the browser}
    A->>DB: CREATED + fileCreate
    Note over C: even minutes (*/2)
    C->>DB: *-create.ts: re-validate everything, one $transaction → CREATE_SUCCESS | CREATE_ERROR, fileCreated
```

### New

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API (tRPC)
    participant G as Cloud Storage
    participant Q as Redis (BullMQ)
    participant W as Worker
    participant DB as Postgres
    B->>B: decode (UTF-8 / Shift_JIS) + parse + row schema → format errors at once
    B->>A: attachment.createUploadUrl {kind: CSV_IMPORT}
    B->>G: PUT file
    B->>A: csvImport.create {type, attachmentId}
    A->>DB: one transaction: csv_imports UPLOADED + attach the file
    A--)Q: after commit: check job {csvImportId, traceId}
    W->>DB: claim UPLOADED → CHECKING
    W->>G: download the file; decode + parse + row schema + database checks
    W->>DB: csv_import_rows (line, data, errors), counts → CHECKED
    B->>A: csvImport.byId every 2 s while working → 内容確認
    B->>A: csvImport.confirm {id, lineNumbers}
    A->>DB: CHECKED → CONFIRMED, rows selected
    A--)Q: after commit: import job
    W->>DB: claim CONFIRMED → IMPORTING; per row: the entity's service (its own transaction) → row result, processedCount
    W->>DB: IMPORTED (counts) | FAILED (lastError)
    B->>A: polling → 結果; csvImport.errorCsv → file
```

### Side by side

| Stage            | Legacy d-round                                                                    | romuten-v3                                                                            | New                                                                              |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Trigger          | two `cron` jobs in the API process, every 2 min, `RUN_CRON`                       | BullMQ queue `source-csv-upload`, jobs `check` / `create`, inside the backend process | BullMQ queue `csv-import`, jobs `check` / `import`, consumed in `apps/worker`    |
| Concurrency      | every pending row at once, no claim, no PROCESSING state                          | claim (`updateMany where status`), `*_PROCESSING`, concurrency 2                      | the same claim, `CHECKING` / `IMPORTING`, concurrency 2                          |
| Lost work        | none — the next tick picks `UPLOADED` / `CREATED` up again                        | recovery job every 60 s re-enqueues `UPLOADED` / `CREATED`                            | sweeper every 2 min: re-enqueue, release a stale check, fail a stale import (D3) |
| Parse            | browser (papaparse, `dynamicTyping: true`)                                        | browser (papaparse, `dynamicTyping: false`)                                           | browser for feedback, worker on the stored file for truth (D6)                   |
| Encoding         | UTF-8 only                                                                        | UTF-8 only                                                                            | BOM / strict UTF-8 / Shift_JIS (D6)                                              |
| Check            | `*-check.ts` per type, hand-written validators                                    | `*.check.ts` per type                                                                 | one row schema mapped onto the API's own input schema + database checks (D7)     |
| Confirm          | the browser sends the rows again                                                  | `selectedIndexes`                                                                     | `lineNumbers` (D7)                                                               |
| Import           | `*-create.ts` re-validates, one `$transaction` for the batch                      | per row, `fileJsonFinish` with a status per row                                       | per row through the entity's service, a result per row (D8)                      |
| Storage of rows  | `SourceCsvHistoryData`: 4 JSON blobs                                              | 4 JSON columns on the history row                                                     | `csv_import_rows`, one row per CSV line (D5)                                     |
| Error report     | `downloadCsvUploadHistory`, `*_UPLOAD` types only                                 | the detail table                                                                      | `csvImport.errorCsv` for every type, rendered from the rows (D9)                 |
| Progress         | none — "reopen 履歴 after 5 min"                                                  | none — the same toast                                                                 | polling `byId` while working, `processedCount` (D10)                             |
| Uploaded file    | `SourceFile` row without owner, object never read                                 | stored path on the history row                                                        | attachment `CSV_IMPORT` owned by the import (D5)                                 |
| Who sees history | own rows only (`SourceCsvHistory: { createdBy }` for every role)                  | the company's rows                                                                    | own rows only (D11)                                                              |
| Download         | sync mutation, xlsx (SheetJS 0.20.3 vendored), ≤ 500 ids, base64 stored in the DB | download templates (not in the d-round legacy)                                        | sync procedure, xlsx, ≤ 500 ids, the file stored as an attachment (D15)          |

### Legacy gaps this plan closes

1. **G1** — the cron runs inside the API process and takes every pending row at once without a
   claim; a tick that outlasts two minutes overlaps the next and processes the same rows twice.
2. **G2** — two 2-minute ticks plus "close the dialog and reopen 履歴 after 5 minutes"
   (`CsvUploadContent` toast) — the user polls by hand.
3. **G3** — failure reasons are lost: an exception becomes `CREATE_ERROR` and
   `console.log(error, 'TODO: create user csv cron alert')`.
4. **G4** — no Shift_JIS: a file saved by Japanese Excel decodes to mojibake and every cell fails.
5. **G5** — `dynamicTyping: true` drops leading zeros (郵便番号 `0600000`, 電話番号) and turns
   number-like text into numbers.
6. **G6** — the uploaded object is never read nor linked (`uploadSourceCsv` ignores `fileKey`; the
   `SourceFile` row has no owner).
7. **G7** — the create step trusts rows the browser sends back (`createSourceCsv` → `fileCreate`).
8. **G8** — every type has a check and a create copy of the same validators (16 files, ~4,300 lines,
   no tests), and they drift from the forms' rules.
9. **G9** — all-or-nothing create: one bad row or one database error discards the batch and the user
   is not told which row.
10. **G10** — the error list downloads only for `*_UPLOAD`; the history's 取込可能 / 取込不可 are
    wrong before the create (`createdCount` is 0); the limit check is `>= 150` while the text
    says 150.
11. **G11** — templates: the BRANCH update template does not exist (`fileMap.ts` names a missing
    file) and `public/csv/template/USER/update/` holds the 追加 file.
12. **G12** — only `text/csv` is accepted; Windows with Excel installed can report a `.csv` as
    `application/vnd.ms-excel`.

## (b) Architecture decisions

### D1 ⚑ Where the import runs: the worker runs the API's job runners

The import must create users, staff, clients and branches with exactly the rules the forms use
(numbering, 担当者 active and in the region, role assignment, invitation mail). Those rules live in
`apps/api/src/modules/*/*.service.ts`, and `.claude/rules/layers.md` says the worker never imports
`@repo/api`. The services need only `ctx.db`, `ctx.ability` and, for `user.invite`, `ctx.auth` (no
request headers).

**Decision (recommended):** the CSV logic is an API module (`apps/api/src/modules/csv-import/`) and
exposes its two job runners through a new package entry `@repo/api/jobs` (`apps/api/src/jobs/`). The
worker still owns the consumer (`createWorker` stays lint-forbidden elsewhere) and calls the runner.
A runner builds a context for the import's creator with `buildJobContext({ userId, traceId })`
(`apps/api/src/core/context.ts`, next to `buildRequestContext`): the creator's **current** grants,
so a revoked permission stops the import; a deactivated creator fails the import. The API's
`createAuth` wiring moves into one function both composition roots call, so the worker's Better Auth
sends the same outbox mails.

Rule changes (named so the approval covers them): `.claude/rules/layers.md` — the worker may import
`@repo/api/jobs` and nothing else from `@repo/api`; `packages/eslint-config/boundaries.js` — element
`api-jobs` (`apps/api/src/jobs`), allowed from `worker`, itself allowed to import `api-service`,
`api-core` and shared packages; `.claude/rules/queue.md` — the CSV import as the second reference
job; `docs/adr/0013-csv-import.md`. CLAUDE.md's "consumers only in apps/worker" stays true.

Alternatives: **B** — a shared domain package for the four entities' writes: the same result, but
moves four services and changes the layer contract more. **C** — import synchronously inside
`csvImport.confirm`: no rule change, but 150 invites hash passwords and send mail inside one HTTP
request (seconds to tens of seconds, no progress), and the brief asks for worker import. **D** —
copy the rules into worker importers (legacy, romuten-v3): G8 again. Rejected.

### D2 Infrastructure: Redis, BullMQ and the worker app already exist

`docker-compose.yml` runs `redis:8-alpine` with AOF on `${REDIS_PORT}` (6380 locally) and
RedisInsight; `REDIS_URL` is in `.env.example`; `@repo/queue` wraps BullMQ 6.3.4; `apps/worker` is a
separate app with graceful shutdown and the email and attachment jobs (ADR 0004, ADR 0012). Nothing
is added for Redis. The worker stays a **separate app** (the brief's "inside the API or separate"):
imports are CPU and database heavy and must not slow API requests, the two scale and restart
independently, and the lint rule already enforces it; romuten-v3's in-process workers
(`startBullmqWorkers` in the backend) are the counter-example. Additions: the worker's env gains
`BETTER_AUTH_SECRET`, `API_URL` and `WEB_ORIGIN` (D1), and a deployed Redis must run
`maxmemory-policy noeviction` (BullMQ's requirement; Google Cloud Memorystore defaults to
`volatile-lru`).

### D3 Queue, jobs, retry and recovery

One queue `QUEUE_NAMES.csvImport = "csv-import"`, payload `CsvImportJob = { csvImportId, traceId? }`
(ID only), job names `check` and `import`, jobIds `jobIdFor("csv-check", id)` and
`jobIdFor("csv-import", id)` (romuten-v3's `source-csv:check:<id>` uses `:`, which `jobIdFor`
refuses). Both are enqueued with `afterCommit`. Worker concurrency 2 (romuten-v3
`SOURCE_CSV_WORKER_CONCURRENCY`).

| Job      | Attempts                      | Transient error (database, storage)                                   | Permanent error                                                        | Lost or stuck                                                                                                         |
| -------- | ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `check`  | 5 (default, backoff from 3 s) | release `CHECKING → UPLOADED`, rethrow; the next attempt claims again | unreadable file → `CHECKED` with a file error; last attempt → `FAILED` | sweeper: `UPLOADED` older than 1 min → enqueue; `CHECKING` not updated for 10 min → `UPLOADED`                        |
| `import` | 1 (a retry would re-run rows) | a row's error fails that row only; an error outside a row → `FAILED`  | —                                                                      | sweeper: `CONFIRMED` older than 1 min → enqueue; `IMPORTING` not updated for 10 min → `FAILED` "処理が中断されました" |

The check is pure (it replaces the import's rows), so it may run again. An interrupted import is not
resumed automatically: rows already imported keep their result, the error CSV lists the rest, and
the user uploads those again — no row can be written twice. The sweeper is a job scheduler
(`upsertJobScheduler("csv-import-sweeper", { every: 120_000 })`), as `outbox-sweeper.ts`. BullMQ's
`job.updateProgress` and return values are not used: completed jobs leave Redis after 24 h, the row
stays.

### D4 States — the row is the truth

`UPLOADED → CHECKING → CHECKED → CONFIRMED → IMPORTING → IMPORTED`, and `FAILED` (a system failure,
`lastError` set) from `CHECKING` or `IMPORTING`. Every transition is one
`updateMany where { id, status: <from> }` (romuten-v3 `claimSourceCsvJob`); a second claim changes
nothing and the job ends. The UI shows the legacy labels (`CsvUploadHistoryContent` `STATUS_MAP`):

| Status                   | Label                                     | Dialog step        | Action |
| ------------------------ | ----------------------------------------- | ------------------ | ------ |
| `UPLOADED`, `CHECKING`   | 確認中                                    | 内容確認 (waiting) | —      |
| `CHECKED`, errors > 0    | 確認エラー                                | 内容確認           | 登録   |
| `CHECKED`, no errors     | 確認完了                                  | 内容確認           | 登録   |
| `CONFIRMED`, `IMPORTING` | 登録中                                    | 登録 (n / m)       | —      |
| `IMPORTED`, failed > 0   | 登録エラー                                | 結果               | 確認   |
| `IMPORTED`, failed 0     | 登録済み                                  | 結果               | 確認   |
| `FAILED`                 | システムエラー (romuten-v3 `SystemError`) | 結果               | 確認   |

### D5 Data model (schema folder `csv/`, migration `add_csv_imports`, ADR 0013)

- `CsvImport` (`csv_imports`): `id` (uuid7), `type` (`CsvImportType`: `USER_CREATE`, `USER_UPDATE`,
  `STAFF_CREATE`, `STAFF_UPDATE`, `CLIENT_CREATE`, `CLIENT_UPDATE`, `BRANCH_CREATE`, `BRANCH_UPDATE`
  — the legacy `EnumCsvUploadType`), `status` (`CsvImportStatus`), `fileName`, `createdById` →
  `users`, `totalCount`, `validCount`, `selectedCount`, `processedCount`, `importedCount`,
  `failedCount`, `lastError`, `checkedAt`, `confirmedAt`, `importedAt`, `createdAt`, `updatedAt`;
  indexes `(createdById, type, createdAt)` for 履歴 and `(status, updatedAt)` for the sweeper.
- `CsvImportRow` (`csv_import_rows`): `csvImportId` (cascade), `lineNumber` (the CSV line; the
  header is line 1, as the legacy's `index + 2`), `data` (Json: column key → cell text, as read),
  `errors` (`text[]`, the check's messages), `selected`, `result` (`IMPORTED` | `FAILED`, null until
  imported), `resultError`, `entityId` (the user, staff, client or branch written); unique
  `(csvImportId, lineNumber)`.
- The file: attachment kind `CSV_IMPORT` (`text/csv` and `application/vnd.ms-excel` with `.csv`, 5
  MB, one file, folder `csv-imports`) and the owner column `attachments.csv_import_id` — ADR 0012's
  "a new owner is one kind, one nullable column and one additive migration".
- Why a row table instead of the legacy's four JSON blobs (and romuten-v3's three): the import
  writes one result per row as it goes (progress, crash-safe), counts and the error CSV are queries,
  and a row's errors never need the whole document rewritten.
- Expand-only: two new tables, two enum values on `attachment_kind`, one nullable column. Nothing is
  migrated from MySQL (the legacy history stays in the legacy database).
- `CsvExport` (`csv_exports`, D15): `type` (`USER`, `STAFF`, `CLIENT`, `BRANCH`), `fileName`,
  `rowCount`, `createdById`, `createdAt`; its file is an attachment `CSV_EXPORT` owned through
  `attachments.csv_export_id`.

### D6 Reading the file: one parser for the browser and the worker

`packages/validation/src/csv/` holds pure functions both sides run:

- `decodeCsv(bytes)`: a UTF-8 BOM → UTF-8; otherwise `new TextDecoder("utf-8", { fatal: true })`; if
  that throws, `new TextDecoder("shift_jis")`. Browsers implement `shift_jis` (Encoding Standard);
  Node 24 does too (checked on v24.14.0: `0x82a0 0x82a2` → 「あい」, and strict UTF-8 throws
  `TypeError` on it).
- `parseCsv(text, type)`: `csv-parse` 7.0.3 sync — already a dependency of `packages/database`
  (seeds), so no new library; its browser ESM build serves the web (a bundling spike in T4, fallback
  papaparse 5.7.0 as the legacy). Every cell stays a string (romuten-v3's `dynamicTyping: false`,
  G5); the header row maps to keys through the type's columns, aliases included (romuten-v3
  `CsvHeader` / `createCsvHeaderMap`); a missing required header, an empty file or more than 150
  data rows is a file error; blank lines are skipped.
- `toCsvText(columns, rows)`: UTF-8 with BOM, CRLF, every field quoted (the legacy's error list:
  `﻿` + `record_delimiter: 'windows'` + `quoted_string`), so Excel opens it and a line break inside
  a cell stays inside it.

Limits: 5 MB, 150 data rows inclusive (legacy `CsvUpload`; G10). The browser runs `parseCsv` the
moment a file is picked, so format errors show at once (legacy parity); the worker downloads the
stored object and runs it again — the file, not the browser, is the truth (G6, G7). That needs
`StorageProvider.download(key)` (and `upload` for D15) in `@repo/storage`: additive, a line under
ADR 0012 `## Changes`.

### D7 Validation: one row schema per type, the API's own input schema behind it

- `packages/validation/src/csv/<entity>.csv.ts` defines each type once with `defineCsvType`:
  `columns` (`{ key, header, aliases?, required? }`, the legacy `*_CSV_HEADER_MAP` order and
  headers), `rowSchema` (zod over the cell strings: required, kana, dates `YYYY/MM/DD`, phone and
  post code via the existing `phone.schema.ts` helpers, label → code maps such as `東日本 → EAST`,
  `アドミン → admin`), and `toInput(row)` → the API's existing input (`inviteUserSchema`,
  `createStaffSchema`, …), which is then parsed by that same schema. A CSV rule can therefore not
  drift from the form's rule (G8). In-file duplicates (メールアドレス, 社員番号, 番号) are one
  array-level check (legacy `validateUniqueInCsv`).
- Browser: `rowSchema` + duplicates — format errors only, as the legacy `CsvUploadError`.
- Worker `check`: the same, then database checks per type in the API module's importer: already
  registered (email, 社員番号, スタッフ番号, クライアント番号, 就業先番号), reference names
  (地域, 都道府県 → codes), 担当者メール active and in the row's 地域 (legacy
  `validateChargerRegionRelation`), the branch's client, and for `*_UPDATE` the target found by its
  number (legacy `*-update-check.ts`).
- Messages are Japanese and name the column, as the legacy validator: `姓: 必須`,
  `メールアドレス: a@b.jp 既に登録されています`, `メールアドレス: a@b.jp CSV内で重複しています`.
- Confirm sends `lineNumbers`; the service accepts only lines of the caller's own `CHECKED` import
  that have no errors (romuten-v3 `selectedIndexes`, G7).

### D8 Transactions: per row, partial success

Each confirmed row is one call of the entity's service (`userService.invite` / `update`,
`staffService.create` / `update`, …), which opens its own `withTransaction`; the row's result is
written right after. A row that fails (a 社員番号 taken since the check, a role the creator may not
give) records the error and the import continues. A domain error becomes the row's message: the
services' Japanese constants as they are (`STAFF_NUMBER_TAKEN`, `CLIENT_NUMBER_TAKEN`, …), the rest
mapped by class in one table (`ConflictError` → 既に登録されています, `ForbiddenError`
→権限がありません, anything else → 登録できませんでした). All-or-nothing (legacy `createCsvTick`,
G9) is rejected: the check already removed the rows that would fail, so a late failure is a race
that should cost one row, not the file.

### D9 The error CSV is rendered, not stored

`csvImport.errorCsv({ id })` returns the text of `toCsvText` over the rows with check errors, a
`FAILED` result, or no result after an interrupted import: the original columns,
then 行番号 and エラー内容. It works for every type (G10). No second file in the bucket: the rows
are the result, and the CSV is a view of them that cannot disagree with the history.

### D10 Progress: polling `byId`, not SSE

The web's tRPC client has one `httpBatchLink`; an import takes seconds. The dialog's
`csvImport.byId` query sets React Query's `refetchInterval` to 2 s while the status is `UPLOADED`,
`CHECKING`, `CONFIRMED` or `IMPORTING`, and stops otherwise; the worker bumps `processedCount` after
each row (≤ 150 small updates). SSE would need `splitLink` + `httpSubscriptionLink` (tRPC 11.18
supports it), CORS with credentials on a streaming route and a Redis pub/sub bridge (`createPubSub`
exists). It becomes worth it when the notifications ticket ports the legacy `graphql-ws`
subscriptions; this screen then swaps its query for a subscription.

### D11 Permissions

No `permissions.csv` change. Upload (追加 / 更新): `create SourceCsvHistory` (catalog 1401) at the
router, and the service checks the entity's `create` or `update` before it enqueues; the import
re-checks per row through the services with the creator's current grants (D1). History, error CSV
and download: `read SourceCsvHistory` (1402) plus the entity's `read`. Every role sees only its own
imports and downloads, as the legacy CASL rule `SourceCsvHistory: { createdBy: user.id }` did for
every role; the service filters `createdById = ctx.user.id` (a service rule; `SourceCsvHistory` is a
catalog subject without a Prisma model, so no `accessibleBy`). Today super_admin, admin and manager
hold 1401 / 1402, `am` holds neither.

### D12 One registry per side instead of `switch (type)` in five places

| Piece                                          | Where                                                                             | Key                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ |
| Columns, row schema, `toInput`, export columns | `packages/validation/src/csv/<entity>.csv.ts`, `CSV_TYPES`                        | `Record<CsvImportType, CsvTypeDefinition>` |
| Database checks + `importRow(ctx, input)`      | `apps/api/src/modules/csv-import/importers/<entity>.importer.ts`, `CSV_IMPORTERS` | `Record<CsvImportType, CsvImporter>`       |
| Titles, template, manual, history labels       | `apps/web/features/csv/utils/csv-type-content.ts`                                 | `Record<CsvImportType, CsvTypeContent>`    |

A new type is an enum value; the three `Record`s then fail typecheck until each side has it. No code
outside these tables branches on the type (romuten-v3 has `switch` in `useCsvUploadForm`,
`validator.ts`, `csv.service.ts`, `processSourceCsvJob`; the legacy in eight places).

### D13 UI: one menu, one stepped dialog — romuten-v3's ideas, not its code

romuten-v3 `features/sourceCsv`, what to take:

- the content map per type (`CSV_UPLOAD_CONTENT_MAP`: title, icon, template, guide, history labels);
- every dialog loaded with `next/dynamic` and rendered only while open;
- status → label / icon / action in one table (`utils/history.ts`);
- the drop zone's states (`CsvDropzone`: empty, dragging, chosen with size and ✕).

What not to repeat, and why:

- hooks returning 18 values into views taking 14–18 props (`useCsvUploadForm` →
  `CsvUploadDialogView`, `useSourceCsvHistoryDetailDialog` → `SourceCsvHistoryDetailDialogView`):
  props drilling with no second consumer. Here each step component reads the import through the one
  `byId` query and receives only the import id and callbacks.
- entity logic hard-coded in shared code (`switch (uploadType)` setting four optional form arrays,
  four optional arrays in `uploadCsvSchema`): D12's registries instead.
- loose types: rows as `Record<string, unknown>` with `_finalStatus: 0 | 1 | 2 | 3` next to `status`
  and `resultStatus` strings; here `CsvImportRow` is a Prisma model with an enum result and the
  router's output types reach the web through `inferRouterOutputs`.
- `memo` / `useCallback` on every component (house style: none without a measured reason).
- the "close and check again in 5 minutes" toast (D10).

Structure (`.claude/rules/ui.md`, feature folders as `features/users`):

```text
apps/web/features/csv/
  containers/csv-menu.tsx                    the toolbar's 「CSV」 menu; dialogs via next/dynamic
  components/import/csv-import-dialog.tsx    Stepper; the step follows the import's status (D4)
  components/import/csv-file-step.tsx        drop zone, local parse, line errors, template / manual links
  components/import/csv-check-step.tsx       rows with their errors, select valid rows, 確定
  components/import/csv-progress-step.tsx    登録中 n / m
  components/import/csv-result-step.tsx      counts, failed rows, エラーCSV
  components/import/csv-rows-table.tsx       check and result share it; columns from the type
  components/history/csv-history-dialog.tsx  履歴 of one type; a row opens the import dialog
  components/export/csv-export-dialog.tsx    selected rows, field choice, ダウンロード
  components/export/csv-export-history-dialog.tsx
  components/csv-status-badge.tsx
  utils/csv-type-content.ts, utils/csv-status.ts (pure, node-tested)
  types.ts
```

The four list pages compose it: each route file passes `<CsvMenu entity="user" />` into its list
container's toolbar slot, as the user detail page hands the staff feature's `UserStaffsContainer` to
`UserDetailContainer` (features do not import each other). The menu reads the list's selection
for ダウンロード from the app-level `stores/row-selection.tsx`. The file step uses the existing
`useAttachmentUpload("CSV_IMPORT")`.

### D14 Mobile: a `ResponsiveDialog`, as `FilterPopover`

`packages/ui/src/components/composed/responsive-dialog.tsx`: the `ContentDialog` props, a
`ContentDialog` at `md` and up, a bottom `Drawer` below — `FilterPopover`'s `useIsMobile` switch and
the legacy `ResponsiveOverlay` (8 files in d-round-web). Four consumers (import, history, export,
export history) meet the "second consumer" rule. The CSV menu itself opens as a drawer list below
`md`, exactly as `FilterPopover`. The `Stepper` shows only the current step's label below `sm` (four
labels do not fit 375 px; the staff form benefits too). Wide tables scroll sideways inside the
drawer.

### D15 Download (export)

Legacy parity: xlsx (the legacy `downloadUserCsv` etc. build a workbook; クライアント adds
a 就業先部署情報 sheet), the fields to include chosen per entity (legacy `csvDownloadFields.ts`,
`DropdownMultiSelect`), the rows chosen in the list (legacy `ids` must not be empty; the info text
says so), at most 500 (`CSV_DOWNLOAD_LIMIT_EXCEEDED`). Built synchronously in the API (500 rows are
fast; no job), stored as an attachment `CSV_EXPORT` so 履歴 can download the same file again (the
legacy stored base64 in the database), returned as a signed read URL.

⚑ Library: SheetJS 0.20.3 from `cdn.sheetjs.com` (the legacy's vendored tarball; the npm `xlsx`
package stops at 0.18.5, `npm view xlsx version` on 2026-10-12, and has known advisories) or exceljs
4.4.0 (`npm view exceljs version`). Recommended: SheetJS 0.20.3, the legacy's output byte for byte.

### Open questions (answer by number)

1. **D1** — the worker runs `@repo/api/jobs` (rule change in `layers.md`, `boundaries.js`,
   `queue.md`, ADR 0013). Recommended: yes.
2. Users created by CSV get the invitation mail, as 担当者追加 does (the legacy created them with a
   reset token and sent nothing: `user-csv-upload-create.ts` has no mail call). Recommended: yes.
3. **D8** — per-row import with partial success. Recommended: yes.
4. **D11** — every role sees only its own imports and downloads (legacy). Recommended: yes.
5. **D15** — SheetJS 0.20.3 tarball or exceljs 4.4.0. Recommended: SheetJS.
6. The four CSV manual PDFs (`public/csv/manual/*`): commit them, or git-ignore them as
   `apps/web/public/help/*.pdf`. Recommended: the same as the help PDFs.
7. Order: the Backlog below follows the brief's stages (infra → engine → UI → history → mobile),
   with users first inside the engine. The alternative is a vertical slice (T1–T6, then T11, T12 and
   T15 for users only, then the other entities), which can be browser-checked a week earlier.
   Recommended: the stage order as listed.

## Legacy → new (screens)

| Legacy (`d-round-web/src/shared/components/csv`)                                                                                                                                                                                                                        | New                                                                                                         | Kept / changed / dropped                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Toolbar` renders `csvContent` inside `<Can I="read" a="Source_csv">`                                                                                                                                                                                                   | `CsvMenu` in the list toolbar's actions; 追加 / 更新 need `create SourceCsvHistory`, the rest `read`        | changed: upload was gated by `read`                              |
| `CsvMenus` popover 「CSV」: {label}を追加 (Upload), {label}を更新 (RefreshCw)                                                                                                                                                                                           | the same two items, plus ダウンロード and 履歴                                                              | changed: one entry for upload, update, download, history (brief) |
| `CsvDownloadDialog` as a separate toolbar icon button                                                                                                                                                                                                                   | the menu's ダウンロード                                                                                     | changed (as above)                                               |
| `CsvUploadDialog` + `CsvUpdateDialog`, `CsvUploadContent` / `CsvUpdateContent` (two 360-line copies)                                                                                                                                                                    | one `CsvImportDialog` for every type                                                                        | merged                                                           |
| `CSV_UPLOAD_TITLE_MAP` (CSVから担当者を追加, …)                                                                                                                                                                                                                         | `csv-type-content.ts`, same titles                                                                          | kept                                                             |
| `CsvUpload` drop zone: click or drag, `text/csv`, 5 MB, the chosen file with ✕                                                                                                                                                                                          | `csv-file-step`: the same, `.csv` as `text/csv` or `application/vnd.ms-excel`                               | kept; G12                                                        |
| client validation → 「CSVエラーが N 件あります」 + `CsvUploadError` table (行, エラーの詳細)                                                                                                                                                                            | the same table inline in the file step                                                                      | kept                                                             |
| 「一度に最大150件」, check `>= 150`                                                                                                                                                                                                                                     | 150 inclusive                                                                                               | fixed (G10)                                                      |
| CSVデータフォーマット / CSVデータ説明書 links (`public/csv/template`, `public/csv/manual`)                                                                                                                                                                              | the same links per type; USER and BRANCH update templates fixed                                             | kept; G11                                                        |
| footer 履歴 / アップロード                                                                                                                                                                                                                                              | footer キャンセル / アップロード (then 確定, 閉じる per step); 履歴 in the menu                             | changed                                                          |
| success toast 「登録完了しておりません！」 with ①②③ and "5分後"                                                                                                                                                                                                         | dropped: the dialog moves on by itself; closing it while working shows 「確認中です。履歴から確認できます」 | changed (G2)                                                     |
| `CsvUploadHistoryContent`: 担当者情報, ファイル名 + 日時, 新規導入数 (取込データ入数 / 取込可能 / 取込不可), ステータス, アクション 登録 / 確認                                                                                                                         | `csv-history-dialog`, the same columns, counts from the rows                                                | kept; G10                                                        |
| `STATUS_MAP` 確認中 / 確認エラー / 確認完了 / 登録中 / 登録エラー / 登録済み                                                                                                                                                                                            | the same labels (D4), plus システムエラー                                                                   | kept                                                             |
| detail modals per type (`CsvUploadHistoryUser`, `…Staff`, `…Client`, `…Branch`, `CsvUpdateHistoryStaff`): a checkbox per valid row, entity-shaped cells, 説明欄, row badges 取込完了 / 取込不可 / 送信完了 / 送信エラー, 戻る / リストダウンロード・エラーリスト / 確定 | 内容確認 and 結果 steps on one `csv-rows-table`; each type names its summary cells in `csv-type-content.ts` | merged (5 components → 1)                                        |
| `CsvUploadHistoryInfo` text above the detail                                                                                                                                                                                                                            | the step's description                                                                                      | kept                                                             |
| エラーリスト download for `*_UPLOAD` only                                                                                                                                                                                                                               | エラーCSV for every type                                                                                    | fixed (G10)                                                      |
| download content per entity: `CsvDownloadInfo`, `DropdownMultiSelect` of fields, 履歴, ダウンロード                                                                                                                                                                     | `csv-export-dialog`: the same info and field choice (`MultiOptionSelect`)                                   | kept                                                             |
| `CsvDownloadHistoryDialog` (per type, download again)                                                                                                                                                                                                                   | `csv-export-history-dialog`                                                                                 | kept                                                             |
| `WorkflowCsvDownloadContent`, `WorkflowListCsvDownloadContent`                                                                                                                                                                                                          | —                                                                                                           | later, with the workflow screens                                 |

## Out of scope

Workflow CSV download (the workflow screens are not ported yet); retention or cleanup of old imports
and exports (the legacy keeps them forever); importing xlsx (the legacy imports CSV only);
romuten-v3's saved download templates (not in the d-round legacy); SSE (D10); an all-or-nothing
switch (D8).

## Risks

- **R1** — D1 not approved: fall back to C (import inside `csvImport.confirm`, no progress for the
  import step); tickets T2 and T5 change, the rest stays.
- **R2** — `csv-parse`'s browser build in Next 16: a 30-minute spike opens T4; fallback papaparse
  5.7.0 (the legacy's) in the browser only.
- **R3** — number allocation under two parallel imports (the client-branch ticket's open
  "number-rule race"): the services' unique constraints turn a collision into one failed row (D8),
  never a duplicate.
- **R4** — 150 invitation mails at once go through the outbox (limiter 20/s): about 8 s, fine.
- **R5** — a deployed Redis that evicts keys loses jobs; D2's `noeviction`, and the sweeper recovers
  them anyway.

## (c) Backlog

Assumptions for the dates: one developer, about one ticket per working day, starting Tuesday
2026-10-13; the user corrects them for the real team. Every ticket is 1–3 points (the Backlog rule:
5 and up are split). Branch per ticket: `feature/D_ROUND-<backlog key>_<slug>`; each ticket's own
`plan.md` (file-level steps and tests) is written when it starts.

| #   | Stage            | Title                                                        | Pt  | Dates | Depends on      |
| --- | ---------------- | ------------------------------------------------------------ | --- | ----- | --------------- |
| T1  | 1 Redis + BullMQ | CSV import: data model, queue contract and ADR               | 3   | 10/13 | —               |
| T2  | 1 Redis + BullMQ | CSV import: worker runs the API's job runners, sweeper       | 3   | 10/14 | T1, ⚑1          |
| T3  | 1 Redis + BullMQ | Storage: server-side download and upload                     | 1   | 10/15 | —               |
| T4  | 2 CSV engine     | CSV engine: decode, parse and write CSV (shared)             | 2   | 10/15 | —               |
| T5  | 2 CSV engine     | CSV engine: check and import pipeline with the user importer | 3   | 10/16 | T2, T3, T4      |
| T6  | 2 CSV engine     | CSV import: tRPC procedures                                  | 2   | 10/19 | T5              |
| T7  | 2 CSV engine     | CSV engine: staff importer                                   | 3   | 10/20 | T5              |
| T8  | 2 CSV engine     | CSV engine: client importer                                  | 2   | 10/21 | T5              |
| T9  | 2 CSV engine     | CSV engine: branch importer                                  | 2   | 10/22 | T8              |
| T10 | 2 CSV engine     | CSV export: xlsx files and their storage                     | 3   | 10/23 | T3, ⚑5          |
| T11 | 3 CSV UI         | CSV UI: menu and import dialog — file step                   | 3   | 10/26 | T6              |
| T12 | 3 CSV UI         | CSV UI: check, import and result steps                       | 3   | 10/27 | T11             |
| T13 | 3 CSV UI         | CSV UI: download dialog                                      | 2   | 10/28 | T10, T11        |
| T14 | 3 CSV UI         | CSV UI: the four list screens, templates and manuals         | 2   | 10/29 | T7–T9, T12, T13 |
| T15 | 4 History        | CSV history: import history                                  | 2   | 10/30 | T12             |
| T16 | 4 History        | CSV history: download history                                | 2   | 11/02 | T13             |
| T17 | 5 Mobile         | CSV mobile: ResponsiveDialog, drawer menu, compact stepper   | 3   | 11/03 | T14–T16         |
|     |                  | **Total**                                                    | 41  |       |                 |

Stage 1 has no Redis work left (D2): the ticket that brings Redis and BullMQ was ADR 0004; T1–T3
build what the CSV jobs need on top of it.

### T1 · CSV import: data model, queue contract and ADR — 3 pt

- Dates: 2026-10-13 – 2026-10-13. Depends on: —.
- Requirement (functional): tables `csv_imports` and `csv_import_rows` with the enums of D4 / D5;
  attachment kind `CSV_IMPORT` and owner column `csv_import_id`; `QUEUE_NAMES.csvImport`,
  `packages/queue/src/jobs/csv-import.job.ts` (`CsvImportJob`, job names, `csvCheckJobId`,
  `csvImportJobId`, `enqueueCsvCheckJob`, `enqueueCsvImportJob`); a repository with one method per
  transition (claim, release, save check, confirm, record row, finish, fail, stale queries).
- Requirement (non-functional): expand-only migration; ADR 0013 written (D1–D12); payload IDs only.
- Plan: `packages/database/prisma/schema/csv/*.prisma`, the migration,
  `packages/database/src/repositories/csv-import.repository.ts`, `packages/queue/src/**`,
  `packages/validation/src/attachment.schema.ts`, `docs/adr/0013-csv-import.md`. Tests
  (testcontainers): a second claim changes nothing; each transition only from its state; stale
  queries by `updatedAt`; jobIds deterministic.
- Description (JP):
  CSVインポート履歴のテーブル（ヘッダーと行）、キュー定義、ステータス遷移を追加する。
- Description (MN): CSV импортын түүхийн хүснэгт (толгой ба мөр), queue-ийн тодорхойлолт, төлөвийн
  шилжилтийг нэмнэ.

### T2 · CSV import: worker runs the API's job runners, sweeper — 3 pt

- Dates: 2026-10-14 – 2026-10-14. Depends on: T1, open question 1.
- Requirement (functional): `@repo/api/jobs` entry with `runCsvCheck` / `runCsvImport` (state moves
  only, no entity yet); `buildJobContext({ userId, traceId })`; one `createAuth` wiring for both
  roots; `apps/worker/src/processors/csv-import.processor.ts` (concurrency 2) and
  `apps/worker/src/schedulers/csv-import-sweeper.ts` (every 2 min, D3).
- Requirement (non-functional): the worker may import only `@repo/api/jobs` (lint); worker env
  `BETTER_AUTH_SECRET`, `API_URL`, `WEB_ORIGIN`; README env table; deployed Redis `noeviction`.
- Plan: `apps/api/src/jobs/*`, `apps/api/src/core/context.ts`, `apps/api/package.json` exports,
  `apps/worker/src/{index,env}.ts`, `packages/eslint-config/boundaries.js`,
  `.claude/rules/{layers,queue}.md`. Tests: a duplicate enqueue runs once; a transient check error
  goes back to `UPLOADED` and is retried; the last attempt fails with `lastError`; the sweeper
  re-enqueues after `FLUSHALL`; a stale `CHECKING` is released, a stale `IMPORTING` fails; a
  deactivated creator fails the import; the worker importing `@repo/api/router` fails lint.
- Description
  (JP): ワーカーがAPIのサービス層を使ってCSVジョブを実行できるようにし、停止・消失したジョブを回復する。
- Description (MN): Worker нь API-ийн service-ийг ашиглан CSV job ажиллуулах, гацсан/алдагдсан
  job-ийг сэргээх (sweeper) суурийг бэлдэнэ.

### T3 · Storage: server-side download and upload — 1 pt

- Dates: 2026-10-15 – 2026-10-15. Depends on: —.
- Requirement (functional): `StorageProvider.download(key)` → bytes,
  `upload(key, bytes, contentType)`; GCS and memory providers.
- Requirement (non-functional): files ≤ 5 MB read into memory; ADR 0012 `## Changes` line.
- Plan: `packages/storage/src/{provider,gcs-storage,memory-storage}.ts`. Tests: memory round trip, a
  missing key, the GCS adapter's request shape as the existing `head` / `delete` tests.
- Description (JP): ストレージにサーバー側のファイル読み込み・書き込みを追加する。
- Description (MN): Storage-д сервер талаас файл унших, бичих функц нэмнэ.

### T4 · CSV engine: decode, parse and write CSV (shared) — 2 pt

- Dates: 2026-10-15 – 2026-10-15. Depends on: —.
- Requirement (functional): `decodeCsv`, `parseCsv`, `toCsvText`, `defineCsvType` and the column
  type in `packages/validation/src/csv/` (D6).
- Requirement (non-functional): runs in the browser and in Node; no new dependency (`csv-parse`
  7.0.3, spike first); every cell a string; 5 MB / 150 rows.
- Plan: `packages/validation/src/csv/{decode,parse,write,define}.ts`, `package.json`. Tests: a
  Shift_JIS fixture, UTF-8 with and without BOM, a quoted line break, leading zeros kept, 150 rows
  pass and 151 fail, a missing required header, Excel's trailing empty columns, the written CSV
  re-parses to the same rows.
- Description (JP): CSVの文字コード判定（UTF-8／Shift_JIS）、解析、出力の共通処理を作る。
- Description (MN): CSV-ийн кодчилол таних (UTF-8 / Shift_JIS), задлах, бичих нийтлэг функцүүдийг
  хийнэ.

### T5 · CSV engine: check and import pipeline with the user importer — 3 pt

- Dates: 2026-10-16 – 2026-10-16. Depends on: T2, T3, T4.
- Requirement (functional): `apps/api/src/modules/csv-import/` service (`create`, `confirm`, `byId`,
  `rows`, `list`, `errorCsv`) and runners (check: download, decode, parse, row schema, database
  checks, rows; import: per row through the service, results, counts); `CSV_IMPORTERS`;
  `user.csv.ts` (legacy `USER_CSV_HEADER_MAP`) and the user importer (`USER_CREATE` →
  `userService.invite`, `USER_UPDATE` → `userService.update` by 社員番号).
- Requirement (non-functional): per-row transactions (D8); enqueue after commit; Japanese row
  messages (D7); the creator's grants re-checked by the services.
- Plan: `apps/api/src/modules/csv-import/**`, `apps/api/src/jobs/*`,
  `packages/validation/src/csv/user.csv.ts`. Tests (testcontainers): nothing enqueued on rollback;
  check finds an in-file duplicate, a registered email, an unknown 地域, a bad date, a missing
  update target; confirm takes only valid lines of one's own `CHECKED` import; an import with one
  failing row imports the others; a revoked grant fails the rows; the error CSV's columns and lines.
- Description (JP): チェック・取込の処理と、担当者CSV（追加・更新）を実装する。
- Description (MN): Шалгах ба импортлох урсгал, 担当者 (хэрэглэгч)-ийн CSV нэмэх/шинэчлэхийг хийнэ.

### T6 · CSV import: tRPC procedures — 2 pt

- Dates: 2026-10-19 – 2026-10-19. Depends on: T5.
- Requirement (functional): router `csvImport` — `create`, `confirm` (`create SourceCsvHistory`),
  `byId`, `rows`, `list`, `errorCsv` (`read SourceCsvHistory`); zod inputs in
  `packages/validation/src/csv-import.schema.ts`.
- Requirement (non-functional): zod → ability → service only; own imports only (D11).
- Plan: `apps/api/src/trpc/routers/csv-import.router.ts`, `router.ts`. Tests: `am` gets FORBIDDEN;
  another user's import is NOT_FOUND; a manager without `create Staff` cannot start a staff import.
- Description (JP): CSVインポートのAPI（tRPC）を追加し、権限と本人の履歴のみを確認する。
- Description (MN): CSV импортын tRPC procedure-уудыг нэмж, эрх болон зөвхөн өөрийн түүхийг шалгана.

### T7 · CSV engine: staff importer — 3 pt

- Dates: 2026-10-20 – 2026-10-20. Depends on: T5.
- Requirement (functional): `staff.csv.ts` (legacy `STAFF_CSV_HEADER_MAP`,
  `STAFF_CSV_UPDATE_HEADER_MAP`: 雇用区分, 氏名・カナ, エリア / 地域 / 都道府県, 担当者メール, 支店名, 生年月日, 性別, 住所, 電話, 役職, 入社日 / 退職日 …)
  and the importer (`staffService.create` / `update` by スタッフ番号; 担当者 active and in
  the 地域).
- Requirement (non-functional): the staff form's rules through `toInput` + `createStaffSchema`.
- Plan: `packages/validation/src/csv/staff.csv.ts`, `importers/staff.importer.ts`. Tests: each
  legacy staff check message once; an update leaves スタッフ番号 unchanged.
- Description (JP): スタッフCSV（追加・更新）のチェックと取込を実装する。
- Description (MN): スタッフ (staff)-ийн CSV нэмэх/шинэчлэхийн шалгалт ба импортыг хийнэ.

### T8 · CSV engine: client importer — 2 pt

- Dates: 2026-10-21 – 2026-10-21. Depends on: T5.
- Requirement (functional): `client.csv.ts` (legacy
  `CLIENT_CSV_HEADER_MAP`: 番号, 名称・カナ, エリア, 地域, 担当者メール, 郵便番号, 住所, 電話, FAX,
  URL, 受注区分) and the importer (`clientService.create` / `update` by クライアント番号).
- Requirement (non-functional): number rules of the client service.
- Plan: `packages/validation/src/csv/client.csv.ts`, `importers/client.importer.ts`. Tests: a
  taken 番号, an unknown 受注区分, a 担当者 outside the 地域.
- Description (JP): クライアントCSV（追加・更新）のチェックと取込を実装する。
- Description (MN): クライアント (client)-ийн CSV нэмэх/шинэчлэхийн шалгалт ба импортыг хийнэ.

### T9 · CSV engine: branch importer — 2 pt

- Dates: 2026-10-22 – 2026-10-22. Depends on: T8.
- Requirement (functional): `branch.csv.ts` (legacy
  `BRANCH_CSV_HEADER_MAP`: クライアント番号, 番号, 名称・カナ, エリア, 地域, 担当者メール, 部署, 連絡担当者 …)
  and the importer (`branchService.create` / `update` by クライアント番号 + 就業先番号).
- Requirement (non-functional): a branch row names an existing client by クライアント番号; clients
  from a CSV are imported before their branches.
- Plan: `packages/validation/src/csv/branch.csv.ts`, `importers/branch.importer.ts`. Tests: an
  unknown クライアント番号, a 地域 outside the エリア, an update of another client's branch.
- Description (JP): 就業先部署CSV（追加・更新）のチェックと取込を実装する。
- Description (MN): 就業先部署 (branch)-ийн CSV нэмэх/шинэчлэхийн шалгалт ба импортыг хийнэ.

### T10 · CSV export: xlsx files and their storage — 3 pt

- Dates: 2026-10-23 – 2026-10-23. Depends on: T3, open question 5.
- Requirement (functional): `csvExport.create({ type, ids, fields })` → the xlsx (クライアント with
  its 就業先部署情報 sheet), stored as attachment `CSV_EXPORT` owned by a `csv_exports` row,
  answered with a signed read URL; `csvExport.list`, `csvExport.downloadUrl`; export columns per
  entity in `packages/validation/src/csv/*.csv.ts` (legacy `csvDownloadFields.ts`).
- Requirement (non-functional): 1–500 ids (legacy limit); `read SourceCsvHistory` + the entity's
  `read` on each row; dates `YYYY/MM/DD`, labels not codes.
- Plan: `apps/api/src/modules/csv-export/**`, `csv-export.router.ts`, schema `csv_exports`, the
  attachment kind. Tests: 501 ids refused; a row the caller may not read is left out; the workbook's
  sheets and headers; 履歴 lists only one's own files.
- Description (JP): 選択した一覧データをxlsxで出力し、ダウンロード履歴用にファイルを保存する。
- Description (MN): Сонгосон мөрүүдийг xlsx болгон гаргаж, татсан түүхэнд зориулж файлыг хадгална.

### T11 · CSV UI: menu and import dialog — file step — 3 pt

- Dates: 2026-10-26 – 2026-10-26. Depends on: T6.
- Requirement (functional): `CsvMenu` (追加 / 更新 / ダウンロード / 履歴 by ability), the import
  dialog's `Stepper` and the file step: drop zone, local `parseCsv` + row schema with the line error
  table, template and manual links, upload through `useAttachmentUpload("CSV_IMPORT")`,
  `csvImport.create`.
- Requirement (non-functional): dialogs via `next/dynamic`; a `.csv` reported as
  `application/vnd.ms-excel` is accepted; the submit is disabled while uploading.
- Plan: `apps/web/features/csv/{containers,components/import,utils}/*`. Tests (jsdom, StrictMode): a
  Shift_JIS file shows its rows' errors; 151 rows refused; an ability without
  `create SourceCsvHistory` hides 追加 / 更新.
- Description (JP): CSVメニューと取込ダイアログ（ファイル選択ステップ）を作る。
- Description (MN): CSV цэс ба импортын цонхны файл сонгох алхмыг хийнэ.

### T12 · CSV UI: check, import and result steps — 3 pt

- Dates: 2026-10-27 – 2026-10-27. Depends on: T11.
- Requirement (functional): 内容確認 (rows with errors, valid rows selectable,
  select-all, 確定), 登録 (n / m), 結果 (counts, failed rows, エラーCSV download); the step follows
  the status; polling while working (D10).
- Requirement (non-functional): polling stops in a final state and while the dialog is closed.
- Plan: `components/import/csv-{check,progress,result}-step.tsx`, `csv-rows-table.tsx`,
  `utils/csv-status.ts`. Tests: each status renders its step; select-all picks only valid rows; the
  error CSV link.
- Description (JP): 内容確認・登録・結果の各ステップを作り、処理状況を自動で更新する。
- Description (MN): Шалгалтын үр дүн, импорт, үр дүнгийн алхмуудыг хийж, төлөвийг автоматаар
  шинэчилнэ.

### T13 · CSV UI: download dialog — 2 pt

- Dates: 2026-10-28 – 2026-10-28. Depends on: T10, T11.
- Requirement (functional): the info text (select rows in the list first), the field choice per
  entity (legacy defaults ticked), ダウンロード → the signed URL.
- Requirement (non-functional): the selection comes from `stores/row-selection.tsx`; > 500 rows
  shows the legacy message.
- Plan: `components/export/csv-export-dialog.tsx`. Tests: no selection disables ダウンロード; the
  chosen fields reach the procedure.
- Description (JP): 一覧で選択したデータの項目を選んでダウンロードするダイアログを作る。
- Description (MN): Жагсаалтаас сонгосон өгөгдлийн талбаруудыг сонгон татах цонхыг хийнэ.

### T14 · CSV UI: the four list screens, templates and manuals — 2 pt

- Dates: 2026-10-29 – 2026-10-29. Depends on: T7–T9, T12, T13.
- Requirement (functional): 担当者, スタッフ, クライアント, 就業先部署 lists get `CsvMenu` through
  their route files; templates per type (USER and BRANCH update templates made from the headers);
  manual PDFs as decided in open question 6; the `users-toolbar.tsx` TODO removed.
- Requirement (non-functional): browser check of each list as super_admin, admin, manager and AM
  next to the legacy screen.
- Plan: `apps/web/app/admin/{master/user,staff,client,branch}/page.tsx`, the four list containers'
  slot, `apps/web/public/csv/**`. Tests: `route-tree.test.ts` stays green; a template's headers
  equal its type's columns.
- Description (JP): 4つの一覧画面にCSVメニューを追加し、テンプレートと説明書を配置する。
- Description (MN): Дөрвөн жагсаалтын дэлгэцэд CSV цэс нэмж, загвар файл ба гарын авлагыг
  байршуулна.

### T15 · CSV history: import history — 2 pt

- Dates: 2026-10-30 – 2026-10-30. Depends on: T12.
- Requirement (functional): 履歴 of one
  type: 担当者情報, ファイル名 + 日時, 取込データ / 取込可能 / 取込不可 / 登録, ステータス, アクション (登録 / 確認)
  opening the import dialog at its step.
- Requirement (non-functional): server paging (`DataTable` + `PaginationBar`); own imports only.
- Plan: `components/history/csv-history-dialog.tsx`, `csv-status-badge.tsx`. Tests: the counts; the
  action per status; another user's import is absent.
- Description (JP): CSVインポート履歴（担当者・日時・件数・ステータス）を作る。
- Description (MN): CSV импортын түүх (хэн, хэзээ, тоо, төлөв)-ийг хийнэ.

### T16 · CSV history: download history — 2 pt

- Dates: 2026-11-02 – 2026-11-02. Depends on: T13.
- Requirement (functional): 履歴 in the download dialog: ファイル名, 件数, 日時, download again.
- Requirement (non-functional): a fresh signed URL per click (15 min); own files only.
- Plan: `components/export/csv-export-history-dialog.tsx`. Tests: download again asks for a new URL.
- Description (JP): CSVダウンロード履歴と再ダウンロードを作る。
- Description (MN): CSV татсан түүх ба дахин татах боломжийг хийнэ.

### T17 · CSV mobile: ResponsiveDialog, drawer menu, compact stepper — 3 pt

- Dates: 2026-11-03 – 2026-11-03. Depends on: T14–T16.
- Requirement (functional): `ResponsiveDialog` composed (D14) used by the four CSV dialogs; the CSV
  menu as a drawer list below `md`; the `Stepper` shows only the current label below `sm`.
- Requirement (non-functional): 375 px wide: no horizontal page scroll, tables scroll inside the
  drawer; browser check per role at 375 px.
- Plan: `packages/ui/src/components/composed/responsive-dialog.tsx`, `stepper.tsx`,
  `.claude/rules/ui.md` (composed list), the CSV feature. Tests (jsdom with the `matchMedia` stub):
  dialog at `md`, drawer below; the stepper's compact label.
- Description (JP): スマートフォンではCSVのダイアログとメニューを下からのドロワーで表示する。
- Description (MN): Гар утсанд CSV-ийн цонх ба цэсийг доороос гарах drawer хэлбэрээр харуулна.

## Log

- 2026-10-12 — draft written (phase 2 of the brief); waiting for the answers to the open questions.
- 2026-10-12 — approved by the user ("ok heregjuul"): every open question takes its recommended
  answer (1 the worker runs `@repo/api/jobs`, 2 imported users get the invitation mail, 3 per-row
  import, 4 own imports only, 5 SheetJS 0.20.3, 6 the manual PDFs git-ignored as the help PDFs, 7
  the stage order). One branch for the epic (`feature/D_ROUND-TBD_csv-import`, no Backlog keys yet);
  each ticket is one or more commits named after it.
- 2026-10-12 — amendments while building T1–T6:
  - D3: a check that fails is not released to UPLOADED; its claim accepts CHECKING, so the retry of
    the same job runs again, and a CHECKING import without progress for 10 minutes is failed (a job
    BullMQ gave up on stays in Redis under its id for 7 days, so a re-enqueue would be a no-op). The
    csv-import queue drops failed jobs at once (`removeOnFail`), as the attachment deletes do.
  - Order: T3 (storage) and T4 (the CSV module) were built before T2, so the runners were written
    against the real download and parser; T2 and T5 share commits.
  - D6: `csv-parse`'s browser build is one self-contained ESM file (no imports), so the bundling
    spike passed without papaparse; the CSV module is the separate entry `@repo/validation/csv`.
  - D7: the row schemas are built from the forms' own schema pieces, read through cell readers
    (`textCell`, `integerCell`, `labelCell`, `listCell`, `dateCell` — dates as Excel writes them,
    `2026/1/5` included); a message gets the column's name unless it already names it.
  - 担当者 CSV: 社員番号 is required, as on the form (the legacy numbered blanks itself); the roles
    are アドミン, マネージャー / マネジャー, AM and スタッフ (both AM: the legacy browser check
    wanted スタッフ, its server AM); an update cannot change the address (no screen can), and finds
    its 担当者 by 社員番号.
  - The CSV queue rides in the request context (`ctx.csvImportQueue`), as the attachment deletes'.
- 2026-10-12 — amendments while building T7–T10:
  - T10: the download columns live in `packages/validation/src/csv-export.schema.ts` (main entry),
    not in `csv/*.csv.ts`: the dialog and the input schema need them, and the main entry must not
    load the CSV parser. The browser sends column keys; the API owns headers and cells.
  - T10: the staff download's 緊急連絡先 column is headed 緊急連絡先（電話番号）, as on the form
    (the legacy headed it 電話番号, twice in one sheet); 住所（県・市） is the post
    code's 都道府県・市区町村・町域 and 住所 the typed line, as the legacy split address1 /
    address2.
  - T10: the client download's 就業先部署情報 sheet lists every non-deleted branch of the clients
    (the legacy `branchIds` was never sent) and needs the branch read grant; downloading a file
    again needs the grants to make it now.

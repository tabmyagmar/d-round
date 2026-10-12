# ADR 0013 — CSV import: rows in Postgres, jobs in the worker, rules in the API services

Date: 2026-10-12 · Status: accepted

## Context

The legacy API imported CSV files with two `cron` ticks inside the API process
(`src/jobs/csv/upload`, every two minutes): the browser parsed the file and posted the rows as JSON,
a tick checked every `UPLOADED` history row at once (no claim), the user re-opened 履歴 "after five
minutes", confirmed the valid rows (the browser posted them again) and another tick created them in
one `$transaction`. Failure reasons were lost (`console.log`), Shift_JIS files decoded to mojibake,
leading zeros were dropped (`dynamicTyping: true`), the uploaded object was never read, and every
type had a check and a create copy of the same validators (16 files) that drifted from the forms.
The plan for this port is `docs/plans/2026-10-12-csv-import.md` (`plan.md` while open).

## Decision

- **Rows are the truth** (ADR 0004's shape): `csv_imports` (type, status, counts, `file_error`,
  `last_error`, uploader) and `csv_import_rows` (one per data line: `line_number`, the cells as
  read, the check's `errors`, `selected`, `result`, `result_error`, `entity_id`). Schema folder
  `csv/`, migration `add_csv_imports`. Status
  `UPLOADED → CHECKING → CHECKED → CONFIRMED → IMPORTING → IMPORTED`, or `FAILED` (a system
  failure). Every transition is one conditional update that names the status it expects
  (`createCsvImportRepository`).
- **The file is an attachment** (ADR 0012): kind `CSV_IMPORT` (`text/csv`, or
  `application/vnd.ms-excel` with `.csv`; 5 MB; one), owner column `attachments.csv_import_id`. The
  worker reads the stored object; the browser parses the same file only to show format errors at
  once. The file, not what the browser sends, is what gets imported.
- **Queue** `csv-import`, payload `{ csvImportId, traceId? }`, jobs `check` (jobId `csv-check-<id>`,
  default 5 attempts) and `import` (`csv-import-<id>`, one attempt: a retry would re-run rows),
  enqueued after commit. The check claims `UPLOADED` or `CHECKING` — a retry of the same job may run
  again, the check only reads and replaces rows — and its last failed attempt marks the import
  `FAILED`. A sweeper (every 2 minutes) re-enqueues `UPLOADED` and `CONFIRMED` imports older than a
  minute, and fails `CHECKING` and `IMPORTING` imports whose `updated_at` (bumped by every row) is
  older than 10 minutes: a job BullMQ gave up on stays in Redis under its deterministic id for 7
  days, so re-enqueuing it would be a no-op.
- **Per-row import**: each confirmed row is one call of the entity's service (its own transaction);
  a refused row records its message and the others go on. An interrupted import is not resumed: rows
  already written keep their result and the error CSV lists the rest.
- **The worker runs the API's job runners.** The import must create users, staff, clients and
  branches with exactly the forms' rules, which live in `apps/api/src/modules/*`. The CSV module is
  an API module; its runners are exported through `@repo/api/jobs` (`apps/api/src/jobs`), the only
  part of `@repo/api` the worker may import (`.claude/rules/layers.md`, element `api-jobs` in
  `packages/eslint-config/boundaries.js`). The worker still owns every consumer. A runner acts as
  the import's uploader (`buildJobContext`): their current grants, so a revoked permission stops the
  rows.
- **Messages and limits**: Japanese per-row messages that name the column (the legacy validator's);
  150 data rows and 5 MB per file; UTF-8 with or without BOM, or Shift_JIS.
- **Visibility**: the uploader only, for every role (the legacy rule
  `SourceCsvHistory: { createdBy }`); upload needs catalog 1401 (`create SourceCsvHistory`), history
  1402 (`read`), each plus the entity's own grant.
- **Downloads** (`csvExport`, the legacy `download<Type>Csv`): the rows ticked in a list (1–500, the
  legacy limit) with the columns picked, as an xlsx written inside the request — 500 rows take no
  job. SheetJS 0.20.3 from its CDN tarball writes it as the legacy did (the npm `xlsx` stops at
  0.18.5). The browser sends column keys only; headers and cells are the API's (the legacy walked
  whatever field path the browser sent). The workbook is an attachment of kind `CSV_EXPORT` owned by
  a `csv_exports` row (type, file name, row count, maker; migration `add_csv_exports`),
  so 履歴 hands out the same file again (the legacy kept base64 in the database). The API writes it
  itself (`storeFile`: the PENDING row first, so the sweeper removes an object the transaction never
  attached); a browser never gets its upload URL. Making a download, or downloading it again, needs
  1402 and the entity's read on every row (`canUnscoped`; a クライアント's 就業先部署 sheet needs
  the branch read too), and every download is its maker's only.

## Alternatives

- **Copy the entity rules into worker importers** (the legacy, romuten-v3): the drift this port
  removes. Rejected.
- **A shared domain package for the four entities' writes**: the same outcome, but moves four
  services and changes the layer contract more. Rejected for now.
- **Import inside the confirm request** (no worker): 150 invitations hash and mail inside one HTTP
  request, without progress. Rejected.
- **All-or-nothing import**: one late failure (a number taken since the check) discards every row
  and the user is not told which. Rejected.
- **Rows as JSON blobs on the import** (legacy four, romuten-v3 three): progress and per-row results
  would rewrite the whole document per row; counts and the error CSV would be code instead of
  queries. Rejected.

## Consequences

- The worker needs the API's auth settings (`BETTER_AUTH_SECRET`, `API_URL`, `WEB_ORIGIN`) to send
  the invitation mails of imported users, and depends on `@repo/api`'s job entry.
- A deployed Redis must not evict keys (`maxmemory-policy noeviction`); the sweeper recovers lost
  enqueues anyway.
- Imports and their rows are kept (the legacy kept its history forever); retention is a later
  decision.

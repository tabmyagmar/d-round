# ADR 0011 — クライアント (clients) and 就業先部署 (branches)

Date: 2026-10-08 · Status: accepted

## Context

The legacy API kept a クライアント in the MySQL table `Client`: a unique number, name and reading,
an image, `EnumGeneralStatus`, phone, FAX and web URL, join tables
for エリア (`ClientAreas`), 受注区分 (`ClientOrderTypes`) and 地域 (`SourceRegionsOnClients`), an
address (`ClientAddress`: the post code into the Japan Post master, the master's text a second time,
the typed line), 担当者 (`ClientsOnChargers`) and a `ClientChargerHistory` that no resolver wrote
and no screen read. Deleting a client set `DELETED` and scrambled its number (`encryptInt`) so it
could be reused.

A 就業先部署 was a `Branch`: an optional client (the form required one), a number unique per client,
name and reading, one エリア, one 地域 and a status, with a 1:1 `Department` (number, name, reading,
FAX and a `DepartmentAddress`), a 1:1 `BranchContact` (names, readings, 役職, email; its phone and
FAX were in no form), a `BranchMemo[]` that the form and the detail used as one memo, a
`BranchAddress` nothing used and `BranchesOnChargers`. Deleting a branch removed the row and its
children. Both forms required every field but FAX, URL and the memo.

## Decision

- **Status `general_status` = `ACTIVE | INACTIVE | SUSPENDED`** (利用中 / 保留 / 停止) for clients
  and branches; deletion is `deleted_at`, allowed for a 停止 row only (the legacy rule,
  `deleteClients where status DELETE`), and no list shows deleted rows. As for スタッフ (ADR 0008),
  a number is unique among non-deleted rows by a service rule checked in the write's transaction (a
  partial unique index Prisma cannot express), so a deleted row frees its
  number: クライアント番号 across clients, 就業先番号 within one client.
- **`clients`** (`Client` in the schema folder `client/`, migration `add_clients`): `number`,
  `name`, `name_kana`, `areas source_area[]`, `order_types client_order_type[]`
  (業務請負 / 派遣 / スポット), `phone_number`, `fax`, `web_url`, `status`, `deleted_at`.
  **`client_addresses`** (1:1): `post_code` → `source_addresses.post_code` (`Restrict`) and the
  typed `address1`, as `staff_addresses`. **`client_regions`**: a join table on the region's natural
  `code` (composite key, `Restrict` to the region, `Cascade` to the client). **`client_chargers`**:
  composite key `(client_id, user_id)`, `Restrict` to the user (users are soft-deleted only); the
  form sends the list whole and the service keeps the rows still chosen, removes the others and adds
  the new ones. No charger history: nothing wrote or read it.
- **`branches`** (`Branch` in the schema folder `branch/`, migration `add_branches`): `client_id`
  (required, `Restrict`), `number`, `name`, `name_kana`, `area`, `region_code` (→
  `source_regions.code`, `Restrict`), the 部署 as columns (`department_number`, `department_name`,
  `department_name_kana`, `department_fax`), the 連絡担当者 as columns (`contact_last_name`,
  `contact_first_name`, their readings, `contact_position`, `contact_email`), `memo`, `status`,
  `deleted_at`; **`branch_addresses`** (the 部署's address, 1:1, as `client_addresses`) and
  **`branch_chargers`** (as `client_chargers`). One 部署 and one 連絡担当者 per 就業先, as the
  legacy forms filled them.
- Columns the legacy forms required are `NOT NULL`; FAX, URL, the 部署's FAX and the memo are
  nullable.

## Alternatives

Child tables `branch_departments` and `branch_contacts` in the legacy shape (a join and an upsert
each for one card); a hard delete of branches as in the legacy (a later reference — a workflow, a
staff placement — would dangle); a scrambled number on delete; a `client_charger_histories` table
(no reader); join tables for エリア and 受注区分 (closed sets the database checks as enum arrays,
ADR 0006); the staff's `staff_status` reused for clients and branches (a name that says staff, and
renaming an applied enum is a contract change for nothing).

## Consequences

Several 部署 per 就業先 would be an expand-only child table with a backfill from the columns.
Porting the legacy rows maps `ClientAreas` and `ClientOrderTypes` into the arrays, `Department` and
`BranchContact` into the branch row, the first `BranchMemo` into `memo`, `DELETE` to `SUSPENDED` and
`DELETED` to `deleted_at`; rows without a reading or a contact need those columns relaxed first
(expand) or a backfill. A branch keeps its client when the client is 停止 or deleted, as in the
legacy; the branch form offers non-deleted clients only.

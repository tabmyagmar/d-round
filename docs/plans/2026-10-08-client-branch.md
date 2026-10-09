# Plan: Clients and branches — クライアント管理 + 就業先部署 (list, detail, create, update)

Ticket: `feature/D_ROUND-TBD_client-branch` (off `develop` = `b3a1f29`). Status: **approved
2026-10-08** ("ok heregjuul") with every decision as written; amendments go to the Log; **closed
2026-10-09**. Two phases (A clients, B branches), each green on its own (`yarn verify`),
browser-checked as the four roles and fast-forwarded into `develop` before the next starts; ≤15
files per commit.

Read before this plan — legacy API:
`d-round-api/src/database/schema/{client/client,branch/branch, enums}.prisma`,
`source/{address,sourceHierarchy}.prisma` (`ClientAddress`, `BranchAddress`, `DepartmentAddress`,
`SourceRegionsOnClients`), `graphql/schema/{client,branch,source}.ts`,
`graphql/resolvers/{client,branch}/{queries,mutations,helpers}.ts`, `resolvers/source/queries.ts`
(`getChargerClients`), `helpers/address.ts`, `utils/errors/{client,branch}.ts`; legacy web:
`d-round-web/src/features/client/**`, `features/branch/**` (schema, types, store, hooks, list / form
/ detail / print components, pages), `shared/lib/schemas/{stringSchemas,addressSchemas}.ts`,
`shared/lib/enums/values.ts`; romuten-v3:
`packages/database/prisma/{branch/branch, branch/branchAddress,branch/branchUser,company/company,company/companyAddress}.prisma`,
`apps/web/src/features/branch/**`; this repo: `features/staff` + `docs/plans/2026-10-08-staff.md`
(decisions 3, 5, 6, 8, 9, 10, 11 and its Log), `features/users`, ADR 0005 / 0007 / 0008 / 0009,
`.claude/rules/{layers,module-template,migrations,permissions,repositories,ui,testing}.md`, skill
`feature-screen`.

## Goal and acceptance criteria

Port the legacy クライアント管理 and 就業先部署 features onto the staff ticket's pieces (status
dialog, delete dialog, `HierarchyFields`, `AddressFields`, `Stepper`, charger options, number
pre-check). A client exists first; a branch (就業先部署) belongs to exactly one client and is chosen
from the clients when it is created.

- `/admin/client`: toolbar (検索, filter ステータス / エリア / 地域 / 受注区分, 削除 of the
  selected 停止 rows, クライアント追加); table with
  select, クライアント番号 (sort), クライアント名 (sort), 担当者, 受注区分, 郵便番号・住所, 電話番号, ステータス,
  row actions (詳細 / 編集 / ステータス変更 / 削除 — 削除 only for a 停止 row); everything in the
  URL.
- `/admin/client/[id]`: クライアント情報 on the left, 就業先部署情報 (searchable table of the
  client's branches; a row opens the branch's detail in a dialog) on the right; 編集 by ability.
- `/admin/client/create`, `/admin/client/update/[id]`: the legacy two-step form (基本情報 → 確認)
  with the number pre-check, エリア → 地域 → 担当者, the address from the post code, 電話番号, FAX,
  URL, 受注区分; キャンセル / 戻る / 次へ / 追加・保存 at the bottom.
- `/admin/branch`: toolbar (検索, filter ステータス / エリア / 地域, 削除, 就業先部署追加); table
  with
  select, 就業先番号 (sort), 就業先名 + カナ (sort), クライアント名 (sort), 担当者, 郵便番号・住所, ステータス,
  row actions as the client's.
- `/admin/branch/[id]`: 就業先部署情報, 就業先部署・住所情報, 連絡担当者情報, メモ cards.
- `/admin/branch/create`, `/admin/branch/update/[id]`: the legacy two-step
  form: クライアント名 (searchable), 就業先番号 (filled with the next number of the chosen client on
  create), 就業先名, カナ, エリア → 地域 (single), 担当者; 部署番号 / 部署名 / カナ / FAX /
  address; 連絡担当者 (姓 名 セイ メイ 役職 メール); メモ.
- Every procedure has `requireAbility`; services throw domain errors; data layer testcontainers-
  tested; `yarn verify` green per commit; every screen opened as super_admin, admin, manager and AM
  next to the legacy screen (manager / AM: read only — 詳細 and the lists, no buttons).

## Decisions (each names its reference; the user may override any of them at approval)

1. **Two aggregates, two modules (`client`, `branch`), one ticket in two phases; client first.** A
   branch's `client_id` is required (`Restrict`): the legacy form required it (`clientId` min 1)
   although its column was nullable; romuten-v3 `Branch.companyId` is required.
2. **Status `GeneralStatus ACTIVE | INACTIVE | SUSPENDED` (利用中 / 保留 / 停止) shared by clients
   and branches, plus `deleted_at`; delete is soft and allowed for 停止 rows only; a number is
   unique among non-deleted rows by a service rule.** Staff decisions 8 and 9 (ADR 0008): the legacy
   client scrambled the number on `DELETED` (`encryptInt`) and the legacy branch hard-deleted the
   row with its children — a later reference (a workflow, a staff placement) must not dangle, so
   both become the staff's soft delete. `enum GeneralStatus` (`general_status`, the legacy
   `EnumGeneralStatus` without `DELETED`) is declared in `client/client.prisma` and used by
   `Branch`; `StaffStatus` stays (renaming an applied enum is a contract change for nothing). Labels
   and options at app level (`apps/web/lib/general-status-labels.ts`, two consumers — the staff
   keeps its own).
3. **Client: `clients` + `client_addresses` (1:1) + `client_regions` (join on the natural code) +
   `client_chargers` (plain join, replaced on update); エリア and 受注区分 as enum arrays.** Legacy
   `ClientAreas` / `ClientOrderTypes` were join tables over enums (staff decision 3, ADR 0006
   precedent). `ClientChargerHistory` is written by no resolver and read by no screen → dropped; the
   staff's `unassigned_at` exists for 在籍情報 only, which clients lack. Address as
   `staff_addresses` (`post_code` → `source_addresses`, typed `address1`; staff decision 5).
4. **Branch: one `branches` row holds the 就業先, its 部署 and its 連絡担当者; `branch_addresses`
   (1:1), `branch_chargers` (plain join), `memo` a column.** Legacy `Department` and `BranchContact`
   are 1:1 (`branchId @unique`) and the form fills exactly one of each; `BranchMemo[]` is a list the
   form and the detail use as one memo (`memos[0]`); `BranchAddress` is unused (the department's
   address is the one shown and edited); `BranchContact.phoneNumber` / `fax` are in no form or
   query. Reference: romuten-v3 `branch.prisma` (flat `tel` / `fax` / `url` / `email` +
   `branch_addresses`). Alternative — child tables `branch_departments`, `branch_contacts` —
   rejected: two joins and two upserts for one card each; several 部署 per 就業先 would be an
   expand-only child table later. 就業先番号 is unique per client among non-deleted branches
   (service rule, `countActiveByNumber(clientId, number, exceptId)`); 部署番号 has no rule (the
   legacy `@@unique([branchId, number])` on a 1:1 was vacuous). `area` and `region_code` stay single
   (legacy).
5. **Nullability follows the forms** (ADR 0008 principle): `name_kana`, `phone_number` (client),
   `department_number` / `name` / `name_kana`, the contact's names, readings, 役職 and メール are
   NOT NULL; `fax`, `web_url`, `department_fax`, `memo` nullable. The legacy columns were nullable
   for the CSV import; the data-migration ticket relaxes (expand) what its rows lack.
6. **担当者 options: every active non-super_admin user in kana order for both forms;
   `chargerOptionsSchema.regionCodes` becomes optional.** The legacy client and branch forms asked
   `chargerUsers` without variables (`ClientCreateContainer`, `BranchCreateContainer`); only the
   staff form filtered by regions. One optional field, one service branch, one test row; the staff
   path is unchanged. Alternative (filter by the client's regions) rejected for parity.
7. **クライアント名 in the branch form is a domain picker on `ComboboxField` backed by
   `client.options({ search })`** (ui.md "Domain pickers": debounced server search, first 20 matches
   by number / name / kana among non-deleted clients, kana order; the edit form labels the stored
   client from `branch.byId`'s `client`). Legacy `FormSelectSearchField` over `chargerClients`
   (every client, searched in the browser). The picker lives in
   `features/branches/components/form/client-picker-field.tsx` (one consumer; it calls the client
   router but imports nothing from `features/clients` — features never import each other; its
   `ClientOption` type is read from `AppRouter` in `features/branches/types.ts`).
8. **就業先番号 is filled from `branch.nextNumber({ clientId })` when the client changes on create**
   (legacy `nextBranchNumber`, max + 1 among the client's non-deleted branches). `nextClientNumber`
   had no web consumer → dropped.
9. **Number pre-checks: `client.numberAvailable({ number, excludeClientId? })` at 次へ (legacy
   `clientNumberExists` + `useValidateEntityNumber`, as `staff.employeeNumberAvailable`); none for
   branches (the legacy had none).** The branch container's own `onError` maps `CONFLICT` to the
   legacy toast 入力された就業先番号はすでに登録済みです。内容を再度ご確認ください (ui.md: a
   mutation keeps a legacy message with its own `onError`).
10. **Forms: one schema on `Stepper` + `useStepper` (基本情報 → 確認), create and edit share one
    form through props** (staff decision 11, `staff-form.tsx`). Legacy `STEP1 → CONFIRM` with
    `FormSteps`. Update sends the whole form (staff decision 10: regions and chargers are replaced).
    Client cards: クライアント情報登録 (番号, 名, カナ, `HierarchyFields` エリア / 地域, 担当者
    `MultiSelectField`), 住所・連絡先情報登録 (`AddressFields`, 電話番号, FAX, URL, 受注区分
    `CheckboxGroupField` — three options, ui.md "few options"; the legacy used a multi-select).
    Branch cards: 就業先部署登録 (picker, 就業先番号, 就業先名, カナ, エリア `SelectField`, 地域
    `SelectField` over every region until an エリア is chosen, then that エリア's, cleared when it
    no longer fits (legacy `form.watch('area') ? filtered : all`) — `SelectField` gains
    `valueAs: "number"` and `pruneToOptions`, the same two props `MultiSelectField` already has,
    with the same tests), 担当者), 就業先部署・住所情報登録 (部署番号, 部署名, カナ, FAX,
    `AddressFields`), 連絡担当者情報登録 (`NameFields` with a new optional `names` map, as
    `AddressFields` / `HierarchyFields` take one; 役職 `SelectField` over
    `POSITION_OPTIONS`; メール), メモ (`TextareaField`). Confirm steps are `DescriptionList`s per
    card; actions `FormActions` in a `StickyBar`. A saved create or edit returns to the list,
    and キャンセル goes there too, as both legacy forms (`Routes.Admin_Client.Index`,
    `Admin_Branch.Index`); the staff form's return to the detail followed its own toast's wording,
    which these toasts lack. A `CONFLICT` on save (the number taken meanwhile) is the legacy toast
    through the container's `onError` (Messages).
11. **Detail pages keep the legacy actions only**: the client detail's 編集 (legacy
    `Toolbar onEdit`), one `Can`-guarded button in the container's header beside the client's name
    and status badge (no toolbar component for one button); the branch detail has none (legacy
    `BranchContainer`). The staff-style ステータス変更 / 削除 on a detail is the alternative; not
    built unless asked (user review rule 3: nothing the legacy lacks).
12. **The client detail's 就業先部署情報 is the branches feature's `ClientBranchesContainer`, handed
    to `ClientDetailContainer`'s `branches` slot by the page** (user detail ↔ `UserStaffsContainer`;
    nothing for a caller without `read Branch`). It reads
    `branch.list({ clientId, search, statuses: all })` (the legacy `clientBranches` ignored status),
    paged, with `search` and `page` in the URL (`useTableState`; the legacy paged 10),
    shows 就業先番号 / 就業先名 / 部署名 / 担当者名 (the contact), and a row's chevron opens
    `BranchDetailDialog` (`ContentDialog` via `next/dynamic` around the detail cards) with the row
    itself, as the legacy `branches.find`: decision 4 made 部署 / 連絡担当者 / メモ columns, so one
    include serves `findMany` and `findById` and `BranchRow` is `BranchDetail`. The legacy print
    (`BranchPrint`, a `TODO` stub) and download (`console.log`) buttons are dropped.
13. **Shared write guards move out of the staff service**: `assertChargersActive(db, userIds)` to
    `user.service.ts` (it is about users; three consumers) and the regions / prefectures / post code
    check to `source.service.ts` as
    `assertKnownSource(db, { regionCodes?, prefectureCodes?, postCode? })` (three consumers) —
    helpers over `db`, not procedures over `ctx`, the shape `assertChargersActive` already has
    inside `staff.service.ts`; `staff.service.ts` imports both (`api-service` → `api-service` is
    allowed). The branch service also checks that the region belongs to the
    chosen エリア (`ValidationError`; the legacy form filtered, the API trusted it).
14. **Lists copy `features/staff` file by file** (skill `feature-screen`): URL state through the
    API's list schema, `DataTable` with row selection (`RowSelectionProvider`), `ListToolbar`,
    `FilterPopover` with `next/dynamic` content, `FilterTags`, `RowActions`, status in a
    `ConfirmDialog` holding the select, delete allowed for 停止 rows with 削除 in the toolbar
    while 停止 is filtered (legacy `showDelete`), CSV as a `TODO`. Search: client
    — 番号 (digits), 名, カナ, 担当者名; branch
    — 番号, 名, カナ, クライアント名 / カナ, 担当者名 (the legacy `OR`s). Sort: client by `number` /
    `name` / `createdAt`; branch by `number` / `name` (kana) / `client` (the client's kana) /
    `createdAt`. Without ステータス the API lists every status but 停止.
15. **`postCodeLabel` moves from `features/staff/utils/staff-labels.ts` to
    `components/source/source-labels.ts`** (third consumer; the staff imports follow).
    `GeneralStatusBadge` (`apps/web/components/general-status-badge.tsx`) wraps `StatusBadge` for
    clients and branches.
16. **Dropped or deferred** (own ticket where noted): CSV upload / update / download (CSV ticket),
    print dialogs (`ClientPrintDialog` is rendered nowhere; `BranchPrint` is a stub), `image`
    (file-upload ticket), `ClientChargerHistory`, `BranchAddress`, `BranchContact.phoneNumber` /
    `fax`, `BranchMemo[]` beyond one memo, the notification sent when a branch changes client
    (notification ticket), the cookie draft dialog (staff decision 12), `nextClientNumber`,
    `createdBy` / `updatedBy` (audit ticket), `deleteClients` / `deleteBranches` as separate
    mutations (one `deleteMany` each, 1–50 ids).

## Legacy → new

| Legacy piece (file)                                                                                                        | New                                                                                                                         | Kept / changed / dropped — why                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `Client` (`status EnumGeneralStatus`, `number @unique`, `encryptInt` on delete), `ClientAreas`, `ClientOrderTypes`         | `clients` (`general_status`, `deleted_at`, `areas source_area[]`, `order_types client_order_type[]`)                        | changed — decisions 2, 3                        |
| `SourceRegionsOnClients`, `ClientsOnChargers`, `ClientChargerHistory`                                                      | `client_regions`, `client_chargers`; history dropped                                                                        | changed — decision 3                            |
| `ClientAddress(postCode, address1 auto, address2 typed)` + `createAddress`                                                 | `client_addresses(post_code FK, address1 typed)`                                                                            | changed — staff decision 5                      |
| `Client.image`, `createdBy` / `updatedBy`                                                                                  | —                                                                                                                           | deferred — decision 16                          |
| `Branch(client?, area?, region?, status)`, `Department` (1:1), `BranchContact` (1:1), `BranchMemo[]`                       | `branches` with `department_*`, `contact_*`, `memo` columns; `client_id` NOT NULL                                           | changed — decision 4                            |
| `DepartmentAddress`, `BranchAddress` (unused), `BranchesOnChargers`                                                        | `branch_addresses`, `branch_chargers`                                                                                       | changed — decision 4                            |
| `EnumClientOrder` (業務請負 / 派遣 / スポット), `EnumGeneralStatus`, `EnumArea`, `EnumPosition`                            | `client_order_type`, `general_status`; `source_area`, `position` (exist)                                                    | kept — labels from `shared/lib/enums/values.ts` |
| `clients(where{search, statuses, areas, regions, orderTypes}, orderBy, take, skip)` → `{data, count}`                      | `client.list({ search?, statuses?, areas?, regionCodes?, orderTypes?, sortBy, sortOrder, page, perPage })`                  | changed — `PageResult`                          |
| `client(id)`                                                                                                               | `client.byId({ clientId })` with address, regions, chargers                                                                 | kept                                            |
| `createClient` / `updateClient(CreateClientInput)`                                                                         | `client.create`, `client.update` (full payload)                                                                             | kept — decision 10                              |
| `updateClientStatus` (inline `Select` + `DialogAlert`)                                                                     | `client.changeStatus`; `ClientStatusDialog` from the row menu                                                               | changed — staff decision 8                      |
| `deleteClient(id)`, `deleteClients(ids)` (`≥50` refused, `DELETE` rows only)                                               | `client.deleteMany({ clientIds: 1–50 })`, soft, 停止 only                                                                   | changed — decision 2                            |
| `clientNumberExists(number, exceptId)`, `nextClientNumber`                                                                 | `client.numberAvailable({ number, excludeClientId? })`; next number dropped                                                 | changed — decisions 8, 9                        |
| `chargerClients(where{search, area, regionCode})` (source resolver)                                                        | `client.options({ search? })` → `{ id, name }[]` (20, kana order, non-deleted)                                              | changed — decision 7                            |
| `clientBranches(where{search, clientId}, take, skip)`                                                                      | `branch.list({ clientId, search, statuses })`                                                                               | changed — one list procedure                    |
| `branches(where{search, clientId, statuses, areas, regions}, orderBy, take, skip)`                                         | `branch.list({ search?, clientId?, statuses?, areas?, regionCodes?, sortBy, sortOrder, page, perPage })`                    | changed — `PageResult`                          |
| `branch(id)`, `createBranch` / `updateBranch`, `updateBranchStatus`, `deleteBranch(es)` (hard), `nextBranchNumber`         | `branch.byId`, `branch.create` / `update`, `branch.changeStatus`, `branch.deleteMany` (soft), `branch.nextNumber`           | changed — decisions 2, 4, 8                     |
| `updateBranch` → notification when the client changed                                                                      | —                                                                                                                           | deferred — notification ticket                  |
| `chargerUsers` (no variables) for both forms                                                                               | `user.chargerOptions({})` (regionCodes optional)                                                                            | kept — decision 6                               |
| `ClientColumns`: select, 番号 (sort), 名 (sort), 担当者, 受注区分, 郵便番号・住所, 電話番号, ステータス `Select`, actions  | `clients-table.tsx`: the same columns, `GeneralStatusBadge`, `ClientRowActions` 詳細 / 編集 / ステータス変更 / 削除         | kept — select → badge + dialog                  |
| `ClientsToolbar`: 検索, filter, `CsvMenus`, `CsvDownloadDialog`, 削除 (`showDelete`), クライアント追加                     | `ListToolbar`: `SearchInput`, `ClientFilter`, 削除 (停止 filtered + selection), クライアント追加; CSV TODO                  | kept minus CSV                                  |
| `ClientFilterContent`: ステータス, エリア (`CheckboxSection`), 地域, 受注区分 (`MultiSelectSection`)                       | `client-filter-content.tsx`: `CheckboxGroup` ステータス, `HierarchyFilterFields`, `CheckboxGroup` 受注区分                  | kept — three options → checkboxes               |
| `ClientInfo` rows (番号, 名, カタカナ, エリア, 地域, 担当者, 受注区分, "部署番号" = 〒, 住所, 電話番号, FAX, URL)          | `client-info-card.tsx` (`DescriptionList`, the post code labelled 郵便番号; the whole address)                              | kept — label fixed, as the staff detail         |
| `ClientBranches` (`Toolbar` search / 編集 / print / download, `DataTable`, `BranchDetailDialog`)                           | `ClientBranchesContainer` + `client-branches-table.tsx` (branches feature), `BranchDetailDialog`; 編集 in the client header | kept — print / download dropped (decision 12)   |
| `ClientForm` (`STEP1 / CONFIRM`, `useFormStepper`, `useValidateEntityNumber`, `useCookieValues`)                           | `client-form.tsx` on `Stepper` + `useStepper`, `isNumberFree` guard; no cookie draft                                        | changed — decision 10                           |
| `ClientFormStep1` (two cards), `ClientFormConfirm`                                                                         | `client-basic-step.tsx`, `client-form-confirm.tsx`                                                                          | kept                                            |
| `ClientColumns` / `BranchColumns` 郵便番号・住所: 〒 + `address2` (the typed line only)                                    | 〒 + the whole address (`addressLineOf`: 都道府県, 市区町村, 町域 and the typed line), as the details                       | changed — the detail's line (added at review)   |
| `ClientFormStep1` 地域: every region whatever the エリア (`sourceRegions`)                                                 | `HierarchyFields`: 地域 follows エリア and drops what it no longer covers                                                   | changed — as the staff form (added at review)   |
| `BranchColumns`: select, 番号 (sort), 名 + カナ (sort), クライアント名 (sort), 担当者, 郵便番号・住所, ステータス, actions | `branches-table.tsx`: the same, `GeneralStatusBadge`, `BranchRowActions`                                                    | kept                                            |
| `BranchesToolbar`, `BranchFilterContent` (ステータス, エリア, 地域)                                                        | `branches-toolbar.tsx`, `branch-filter-content.tsx`                                                                         | kept minus CSV                                  |
| `BranchDetail` cards (就業先部署情報, 就業先部署・住所情報, 連絡担当者情報登録, メモ 特に無し)                             | `branch-info-card`, `branch-department-card`, `branch-contact-card` (titled 連絡担当者情報), `branch-memo-card`             | kept — the card title's 登録 dropped            |
| `BranchForm` (`NextBranchNumber` on `clientId` change), `BranchFormStep1` (four cards), `BranchFormConfirm`                | `branch-form.tsx`, `branch-basic-step.tsx`, `branch-form-confirm.tsx`, `client-picker-field.tsx`                            | kept — decisions 7, 8, 10                       |
| `store/`, `context/`, `useXxxVariables`, `useDeleteXxx(s)`, `useUpdateXxxStatus`                                           | `RowSelectionProvider`, `parseSearchParams(listXSchema)`, mutations inside the dialogs                                      | changed — as the staff feature                  |
| `ClientPrint`, `ClientPrintDialog`, `BranchPrint`                                                                          | —                                                                                                                           | dropped — unused / stubs (decision 16)          |

## Schema changes

FLAG — two new schema folders (`client/`, `branch/`), relation fields on `auth/user.prisma`,
`source/source-region.prisma`, `source/source-address.prisma`; expand-only migrations `add_clients`
(A1) and `add_branches` (B1), generated read-only with `prisma migrate diff` while Docker is unsure,
applied to 5433 with `yarn db:migrate` (deploy). ADR: new `docs/adr/0011-clients-and-branches.md`
(decisions 2–5, 8) written before the migration; one `## Changes` line in `0003-permissions.md`
(subject helpers).

```prisma
// client/client.prisma
enum GeneralStatus   { ACTIVE INACTIVE SUSPENDED          @@map("general_status") }    // 利用中 保留 停止
enum ClientOrderType { CONTRACT_WORK DISPATCH SPOT_WORK   @@map("client_order_type") } // 業務請負 派遣 スポット
model Client {
  id          String           @id @default(uuid(7)) @db.Uuid
  number      Int                                     // クライアント番号, unique among non-deleted (service rule)
  name        String           @db.VarChar(100)
  nameKana    String           @map("name_kana") @db.VarChar(100)
  areas       SourceArea[]
  orderTypes  ClientOrderType[] @map("order_types")
  phoneNumber String           @map("phone_number") @db.VarChar(20)
  fax         String?          @db.VarChar(20)
  webUrl      String?          @map("web_url") @db.VarChar(255)
  status      GeneralStatus    @default(ACTIVE)
  createdAt / updatedAt / deletedAt
  address ClientAddress?  regions ClientRegion[]  chargers ClientCharger[]  branches Branch[] (added in B1)
  @@index([number]) @@index([status]) @@index([nameKana]) @@map("clients")
}
// client/client-address.prisma — ClientAddress { id, clientId @unique, postCode, address1 VarChar(200);
//   client Cascade, sourceAddress Restrict } @@index([postCode]) @@map("client_addresses")
// client/client-region.prisma  — ClientRegion { clientId, regionCode, createdAt } @@id([clientId, regionCode])
//   @@index([regionCode]) @@map("client_regions")            (as staff_regions)
// client/client-charger.prisma — ClientCharger { clientId, userId, createdAt; client Cascade, user Restrict }
//   @@id([clientId, userId]) @@index([userId]) @@map("client_chargers")

// branch/branch.prisma
model Branch {
  id, clientId @db.Uuid (client Restrict), number Int, name / nameKana VarChar(100),
  area SourceArea, regionCode Int (region Restrict),
  departmentNumber Int, departmentName / departmentNameKana VarChar(100), departmentFax VarChar(20)?,
  contactLastName / contactFirstName / contactLastNameKana / contactFirstNameKana VarChar(80),
  contactPosition Position, contactEmail VarChar(255), memo String?,
  status GeneralStatus @default(ACTIVE), createdAt, updatedAt, deletedAt
  client Client  region SourceRegion  address BranchAddress?  chargers BranchCharger[]
  @@index([clientId, number]) @@index([status]) @@index([regionCode]) @@index([nameKana]) @@map("branches")
}
// branch/branch-address.prisma, branch/branch-charger.prisma: as the client's.
```

## API

- `client.repository.ts` (`createClientRepository`): `findById` (address + `sourceAddress` parts,
  regions with the region name, chargers with `user { id, name }`),
  `findMany(params, where, orderBy)` (address, chargers; `id` tie-breaker), `create(write)` (one
  nested create), `updateFields(id, fields, address)` (address upsert), `replaceRegions`,
  `replaceChargers`, `countActiveByNumber(number, exceptId?)`, `findStatuses(ids, where)`,
  `updateStatus`, `softDeleteMany`, `findOptions(where, take)` (`{ id, name }`, kana order).
- `client.service.ts`: `list` (`accessibleClientsWhere` + filters; `statuses` default; search `OR`
  with `employeeNumberOfSearch` for 番号), `getById` (`prismaClientSubject`), `create` / `update`
  (one `withTransaction`: number rule → `assertKnownSource` → `assertChargersActive` → write; update
  replaces regions and chargers), `changeStatus` (same status is a no-op), `removeMany` (every id
  found within `accessibleClientsWhere("delete")` and 停止, else `NotFoundError` / `ConflictError`),
  `isNumberAvailable`, `options` (read; 20 matches).
- `branch.repository.ts`: as the client's with one include for `findById` and `findMany` (client
  `{ id, number, name }`, region name, address with the master's parts, chargers with their user;
  `BranchRow` = `BranchDetail`, decision 12), `countActiveByNumber(clientId, number, exceptId?)`,
  `maxNumber(clientId)` (non-deleted rows); no options.
- `branch.service.ts`: `list` (+ `clientId` filter; sort `client` → `client: { nameKana }`, `name` →
  `nameKana`), `getById`, `create` / `update` (client exists and is not deleted → `NotFoundError`;
  number rule per client; region known and in the chosen area; chargers active), `changeStatus`,
  `removeMany`, `nextNumber(clientId)`.
- Routers `clientRouter` / `branchRouter`: `list`, `byId`, `create`, `update`, `changeStatus`,
  `deleteMany` with their catalog action; `numberAvailable`, `options`, `nextNumber` under `read`
  (the forms also need `create` / `update`, which the service's write checks). Registered in
  `router.ts` as `client`, `branch`.
- `permissions`: `ServerSubjects` gains `Client` and `Branch`; `prismaClientSubject`,
  `prismaBranchSubject`, `accessibleClientsWhere`, `accessibleBranchesWhere`; spec rows
  (grant-driven only, no row rule), ADR 0003 line.
- `user.service.ts` exports `assertChargersActive`; `source.service.ts` exports `assertKnownSource`;
  `staff.service.ts` uses both (decision 13). `user.chargerOptions` without `regionCodes` returns
  every active non-super_admin user the caller may read (decision 6).

## Validation (`@repo/validation`)

- `client.schema.ts`: `GENERAL_STATUSES` / `generalStatusSchema`, `CLIENT_ORDER_TYPES` /
  `clientOrderTypeSchema`, `CLIENT_DELETE_MAX = 50`, `urlSchema` (legacy `UrlSchema`: with or
  without a protocol, a host with a dot, ≤255, 有効なURLを入力してください（例: example.com または
  https://example.com）),
  `createClientSchema { number: employeeNumberSchema("クライアント番号"), name: requiredText("クライアント名", 100), nameKana: kanaSchema("クライアント名（カタカナ）", 100), areas (≥1 エリアを選択してください), regionCodes (≥1 地域を選択してください), chargerUserIds (≥1 担当者を選択してください, distinct, ≤100), address: addressSchema, phoneNumber: phoneSchema, fax: faxSchema.nullable(), webUrl: urlSchema.nullable(), orderTypes (≥1 受注種別を選択してください, distinct in the legacy order) }`,
  `clientFormSchema` (`addressFormSchema`), `updateClientSchema` (+ `clientId`), `clientIdSchema`,
  `changeClientStatusSchema`, `deleteClientsSchema` (1–50), `clientNumberAvailableSchema`,
  `clientOptionsSchema { search?: ≤100 }`, `CLIENT_SORT_FIELDS = number | name | createdAt`,
  `listClientsSchema` (search, statuses, areas, regionCodes, orderTypes, sortBy default
  `number asc`, pagination).
- `branch.schema.ts`:
  `createBranchSchema { clientId: idSchema (クライアントを選択してください), number: employeeNumberSchema("就業先番号"), name: requiredText("就業先名", 100), nameKana: kanaSchema("就業先名（カタカナ）", 100), area: sourceAreaSchema (エリアを選択してください), regionCode: z.number().int().min(1) (地域を選択してください), chargerUserIds, departmentNumber: employeeNumberSchema("部署番号"), departmentName: requiredText("部署名", 100), departmentNameKana: kanaSchema("部署名（カタカナ）", 100), departmentFax: faxSchema.nullable(), address: addressSchema, contactLastName / contactFirstName: requiredText(姓 / 名, 80), contactLastNameKana / contactFirstNameKana: kanaSchema(セイ / メイ), contactPosition: positionSchema, contactEmail: emailSchema, memo: ≤2000 nullable }`,
  `branchFormSchema`, `updateBranchSchema`, `branchIdSchema`, `changeBranchStatusSchema`,
  `deleteBranchesSchema`, `nextBranchNumberSchema { clientId }`,
  `BRANCH_SORT_FIELDS = number | name | client | createdAt`, `listBranchesSchema` (+ `clientId?`).
- `user.schema.ts`: `chargerOptionsSchema.regionCodes` optional; `kanaSchema(label, max = 80)` takes
  the limit (the client, branch and department names are 100 wide; the user and staff callers keep
  80); `CHARGERS_MAX = 100` beside `chargerOptionsSchema`, the bound of `chargerUserIds` here (the
  staff keeps `STAFF_LIST_MAX`). `BRANCH_DELETE_MAX = 50` in `branch.schema.ts`.

## Messages (legacy wording, kept unless named)

| Where                                      | Client                                                                                                   | Branch                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Create / update saved (toast)              | クライアント作成 / クライアントが更新されました                                                          | 就業先部署作成 / 就業先部署が更新されました (the legacy 就業先部署店… drops its stray 店)                            |
| Status dialog (変更 / キャンセル), toast   | 該当クライアントのステータスを変更いたします。変更してよろしいでしょうか。 / ステータスが変更されました  | 該当就業先部署のステータスを変更いたします。変更してよろしいでしょうか。 / 就業先部署のステータスを変更しました      |
| Delete dialog (削除 / キャンセル), toast   | クライアントを削除しますか？ / クライアントを削除しました                                                | 就業先部署を削除しますか？ / 就業先部署を削除しました (the legacy bulk toast's が → を, one text)                    |
| Delete refused (`CONFLICT`, `BAD_REQUEST`) | 選択されたクライアントは削除できません / 一度に削除できるクライアントの数を超えています                  | 選択した就業先部署は削除できません / 一度に削除できる就業先部署の数を超えています (the legacy said クライアント)     |
| Number taken (field, at 次へ)              | このクライアント番号は既に使用されています                                                               | — (no pre-check, decision 9)                                                                                         |
| Number taken (`CONFLICT` on save, toast)   | クライアント番号が既に登録されています                                                                   | 入力された就業先番号はすでに登録済みです。内容を再度ご確認ください                                                   |
| Empty list / empty memo                    | 該当するクライアントはいません                                                                           | 該当する就業先部署はありません / 特に無し (the detail's メモ)                                                        |
| Field errors                               | as `createClientSchema` (Validation); 番号 through `employeeNumberSchema` (the legacy copied 従業員番号) | as `createBranchSchema`; the number messages follow `employeeNumberSchema`, not the legacy …は数字で入力してください |

## Web

- App level: `lib/general-status-labels.ts` (`GENERAL_STATUS_LABELS`, `GENERAL_STATUS_OPTIONS`),
  `components/general-status-badge.tsx`, `components/source/source-labels.ts` (+ `postCodeLabel`),
  `components/name-fields.tsx` (+ `names?`); `packages/ui` `SelectField` (+ `valueAs`,
  `pruneToOptions`).
- `features/clients/` —
  `containers/{clients,client-detail,client-create,client-update}-container.tsx`;
  `components/{client-status-dialog,client-delete-dialog}.tsx`;
  `components/list/{clients-table, clients-toolbar,client-filter,client-filter-content,client-row-actions}.tsx`;
  `components/detail/client-info-card.tsx` (the 編集 button sits in the container's header, decision
  11); `components/form/{client-form, client-basic-step,client-form-confirm}.tsx`;
  `utils/{client-labels,client-filters,client-steps, client-form-input}.ts`; `types.ts`
  (`ClientRow`, `ClientDetail`).
- `features/branches/` — the same set with `branch-` names, plus
  `components/branch-detail-dialog.tsx`,
  `components/detail/{branch-info-card,branch-department-card,branch-contact-card,branch-memo-card}.tsx`,
  `components/form/client-picker-field.tsx`, `components/client-branches-table.tsx`,
  `containers/client-branches-container.tsx`; `types.ts` (`BranchRow` = `BranchDetail`,
  `ClientOption`); no detail toolbar (decision 11).
- Pages `app/admin/client/{page,[id]/page,create/page,update/[id]/page}.tsx` and the branch four
  keep their `PageGuard` and swap `PlaceholderPage` for the container; the client detail page hands
  `<ClientBranchesContainer clientId={id} />` to the `branches` slot.

## Files to touch (one table per commit; counts in parentheses)

### Phase A — clients

| Commit                                                                            | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 `feat(db): clients, addresses, regions, chargers; ADR 0011` (11)               | create `docs/adr/0011-clients-and-branches.md`, `prisma/schema/client/{client,client-address,client-region,client-charger}.prisma`, `prisma/migrations/<ts>_add_clients/migration.sql`; edit `prisma/schema/{auth/user,source/source-region,source/source-address}.prisma` (relation fields), `packages/database/src/index.ts` (enums as values, model types), `.claude/rules/migrations.md` (folder, row)                                                                         |
| A2 `feat(database): client repository` (3)                                        | create `src/repositories/client.repository.ts`, `test/repositories/client.repository.test.ts`; edit the barrel                                                                                                                                                                                                                                                                                                                                                                     |
| A3 `feat(permissions): Client subject helpers` (3)                                | edit `packages/permissions/src/server.ts` (`Client` only — the `Branch` model arrives in B1), `test/ability.test.ts`, `docs/adr/0003-permissions.md` (one line for both subjects)                                                                                                                                                                                                                                                                                                  |
| A4 `refactor(api): charger and reference-data guards shared by services` (7)      | edit `packages/validation/src/user.schema.ts` (+ test: `chargerOptionsSchema`, `kanaSchema` max, `CHARGERS_MAX`), `apps/api/src/modules/user/user.service.ts`, `modules/source/source.service.ts`, `modules/staff/staff.service.ts`, `test/modules/user/user.service.test.ts` (charger options without regions), `test/trpc/routers/user.router.test.ts`                                                                                                                           |
| A5 `feat(api): client module` (9)                                                 | create `packages/validation/src/client.schema.ts` (+ `test/client.schema.test.ts`, index), `apps/api/src/modules/client/client.service.ts`, `src/trpc/routers/client.router.ts`, `test/modules/client/client.service.test.ts`, `test/trpc/routers/client.router.test.ts`; edit `src/trpc/router.ts`, `test/support.ts` (`clientInput(chargerUserIds, overrides)`)                                                                                                                  |
| A6 `feat(web): general status labels and badge; post code label at app level` (9) | create `lib/general-status-labels.ts` (+ test), `components/general-status-badge.tsx` (+ test); edit `components/source/source-labels.ts` (+ test), `features/staff/utils/staff-labels.ts` (+ its test) and its two importers (`staff-form-confirm.tsx`, `staff-contact-card.tsx`)                                                                                                                                                                                                 |
| A7 `feat(web): client list — table, toolbar, filters, dialogs` (15)               | create `features/clients/{types.ts, utils/client-labels.ts, utils/client-filters.ts, components/client-status-dialog.tsx, components/client-delete-dialog.tsx, components/list/*.tsx (5), containers/clients-container.tsx}`; edit `app/admin/client/page.tsx`; tests `test/features/clients/{fixtures.ts, utils/client-labels.test.ts, utils/client-filters.test.ts}` — the component tests (table, toolbar, filter content, row actions) are commit A7b when the count passes 15 |
| A8 `feat(web): client detail` (4)                                                 | create `components/detail/client-info-card.tsx` (+ test), `containers/client-detail-container.tsx` (the header with the 編集 button; an optional `branches` slot, so the card stands alone until B5); edit `app/admin/client/[id]/page.tsx`                                                                                                                                                                                                                                        |
| A9 `feat(web): client form — create and update` (13)                              | create `utils/{client-steps,client-form-input}.ts` (+ tests), `components/form/{client-form,client-basic-step,client-form-confirm}.tsx`, `containers/{client-create,client-update}-container.tsx`, `test/features/clients/components/form/{client-form,client-form-confirm}.test.tsx`; edit `app/admin/client/{create,update/[id]}/page.tsx`                                                                                                                                       |
| A10 `docs: clients` (≤3)                                                          | README folder map; `.claude/skills/feature-screen/SKILL.md` only if a rule changed. Browser check as the four roles; the user fast-forwards `develop`.                                                                                                                                                                                                                                                                                                                             |

### Phase B — branches

| Commit                                                                             | Files                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 `feat(db): branches, addresses, chargers` (10)                                  | create `prisma/schema/branch/{branch,branch-address,branch-charger}.prisma`, migration `add_branches`; edit `client/client.prisma` (`branches`), `auth/user.prisma`, `source/source-region.prisma`, `source/source-address.prisma`, `src/index.ts`, `.claude/rules/migrations.md`; ADR 0011 already covers it |
| B1b `feat(permissions): Branch subject helpers` (2)                                | edit `packages/permissions/src/server.ts` (`Branch` in `ServerSubjects`, `prismaBranchSubject`, `accessibleBranchesWhere`), `test/ability.test.ts`                                                                                                                                                            |
| B2 `feat(database): branch repository` (3)                                         | as A2                                                                                                                                                                                                                                                                                                         |
| B3 `feat(api): branch module` (9)                                                  | as A5 (`branch.schema.ts`, service, router, tests, `support.ts` `branchInput(clientId, chargerUserIds, overrides)`)                                                                                                                                                                                           |
| B4 `feat(web): branch list` (15, B4b for the component tests)                      | as A7 under `features/branches/`; `app/admin/branch/page.tsx`                                                                                                                                                                                                                                                 |
| B5 `feat(web): branch detail, its dialog, the client detail's 就業先部署情報` (13) | create `components/detail/*.tsx` (4), `components/branch-detail-dialog.tsx`, `components/client-branches-table.tsx`, `containers/{branch-detail,client-branches}-container.tsx`, tests (3); edit `app/admin/branch/[id]/page.tsx`, `app/admin/client/[id]/page.tsx` (the slot)                                |
| B6 `feat(ui): SelectField valueAs and pruneToOptions; NameFields names` (5)        | edit `packages/ui/src/components/form/select-field.tsx` (+ test), `apps/web/components/name-fields.tsx` (+ new test), `.claude/rules/ui.md` (fields table row)                                                                                                                                                |
| B7 `feat(web): branch form — client picker, next number, create and update` (14)   | create `utils/{branch-steps,branch-form-input}.ts` (+ tests), `components/form/{branch-form,branch-basic-step,branch-form-confirm,client-picker-field}.tsx`, `containers/{branch-create,branch-update}-container.tsx`, tests (2); edit `app/admin/branch/{create,update/[id]}/page.tsx`                       |
| B8 `docs: branches` (≤3)                                                           | README; browser check; the user fast-forwards `develop`. Then protocol Step 6: `/security-review`, MR description, the plan to `docs/plans/2026-10-08-client-branch.md`.                                                                                                                                      |

## Tests to add or update

| Test file                                                                                                                        | Kind         | Asserts                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/database/test/repositories/{client,branch}.repository.test.ts`                                                         | integration  | nested create and read; regions / chargers replaced; `countActiveByNumber` ignores deleted rows; `maxNumber`; options in kana order; soft delete hides the row                                                                                                                                                                                                         |
| `packages/permissions/test/ability.test.ts`                                                                                      | unit         | `accessibleClientsWhere` / `accessibleBranchesWhere` fail closed without the grant; `prisma*Subject` answers as the type                                                                                                                                                                                                                                               |
| `packages/validation/test/{client,branch}.schema.test.ts`, `user.schema.test.ts`                                                 | unit         | url with and without protocol; fax / phone transforms; distinct order types; `regionCode` number; list defaults; `kanaSchema` max; charger options without regions                                                                                                                                                                                                     |
| `apps/api/test/modules/client/client.service.test.ts`                                                                            | integration  | create with address / regions / chargers; taken 番号 → `ConflictError`, freed by a deleted client; unknown region / post code → `ValidationError`; super_admin or deactivated 担当者 refused; update replaces; delete refuses 利用中; manager cannot create; list filters, search, default statuses; options by search                                                 |
| `apps/api/test/modules/branch/branch.service.test.ts`                                                                            | integration  | create under a client; number taken per client; region outside the area refused; deleted client refused; `nextNumber`; list by `clientId`; sort by client kana                                                                                                                                                                                                         |
| `apps/api/test/trpc/routers/{client,branch}.router.test.ts`                                                                      | integration  | `FORBIDDEN` for an AM on create / update / status / delete; `read` allowed; `UNAUTHORIZED` anonymous                                                                                                                                                                                                                                                                   |
| `apps/api/test/modules/user/user.service.test.ts`                                                                                | integration  | charger options without regions list every active non-super_admin user                                                                                                                                                                                                                                                                                                 |
| `packages/ui/test/components/form/select-field.test.tsx`                                                                         | jsdom        | `valueAs: "number"` stores a number; `pruneToOptions` clears a value the options drop                                                                                                                                                                                                                                                                                  |
| `apps/web/test/lib/general-status-labels.test.ts`, `components/general-status-badge.test.tsx`, `components/name-fields.test.tsx` | jsdom / node | labels; tones; `names` map binds nested paths                                                                                                                                                                                                                                                                                                                          |
| `apps/web/test/features/clients/**`, `apps/web/test/features/branches/**`                                                        | jsdom / node | as the staff tests: labels, filters and tags, steps cover every schema field, form input round trip, table columns and row actions by ability, toolbar 削除 only while 停止 is filtered, filter content, form in `StrictMode` (次へ refused with field errors; a taken 番号 stays on the field), confirm shows the values, detail cards, the branches table and dialog |

## Steps (in order)

Each step: test first, then the code; `yarn lint`, `yarn typecheck`, the workspace's tests;
`yarn verify` before the commit (read-only turbo cache while the disk is tight). Context7 before
writing: Prisma 7 enum arrays (`hasSome`) and nested upsert; Base UI Combobox with server search
(`ComboboxField`); react-hook-form `setValue` from `useWatch` (the region reset).

- **A1–A5** schema + ADR, repository, permissions, the shared guards, the client module. A2, A3 and
  A6 touch disjoint files and may run together [parallel: 1]; A4 precedes A5.
- **A6–A9** app-level labels / badge, list, detail, form. Browser (four roles on `/admin/client`,
  detail, create, update): columns, filters and tags, numeric search, sort, select-all, status
  dialog, delete only on 停止, 次へ refused on a taken 番号, address
  lookup, エリア → 地域 → 担当者, 受注区分, confirm, 追加 / 保存, キャンセル / 戻る; manager and AM
  see no buttons. **A10** docs; the user fast-forwards.
- **B1–B3** schema, repository, the branch module. **B4–B5** list, detail, the dialog, the client
  detail's table. **B6** the two field changes. **B7** form. Browser (four roles on `/admin/branch`,
  detail, create, update, and `/admin/client/[id]`): the client picker (search, stored client on
  edit), 就業先番号 filled on client change, エリア → 地域 single, the CONFLICT toast on a
  taken 番号, the detail dialog from the client page. **B8** docs, Step 6.

## Risks and open questions

- **The branch carries a stray commit** (`78401e9`, the discord-alerts session's logger alert
  stream, `docs/adr/0010-alerts.md` and its `plan.md`, committed on this branch by accident while
  both sessions shared one working tree; the discord-alerts branch holds the same commit). Dropping
  it is the user's call: the reset was refused in this session, so this ticket's commits go on top
  of it and never touch its files (`packages/logger`, `docs/adr/0010-alerts.md`, `plan.md` — hence
  this plan's file name), and the user removes it from the branch before the fast-forward. This
  plan's ADR is `0011`, as the alerts ADR holds `0010`.
- **Auto mode denies `.claude/*` edits** (`agent-permissions`): the rows in A1, B1, B6 wait for the
  user to switch mode or apply them; the code commits do not depend on them.
- **Docker** (`local-dev-environment`): migrations are generated schema-to-schema when the Docker
  API hangs; the testcontainers suites, the drift gate, the 5433 deploy and the browser checks run
  once it answers, before a phase is merged. The disk may need a read-only turbo cache.
- **Branch soft delete differs from the legacy hard delete** (decision 2): a 停止 branch is deleted
  the staff way. Override: hard delete with `@@unique([client_id, number])` and no `deleted_at`.
- **Shared guards touch `staff.service.ts`** (A4): behaviour unchanged, its tests stay green.
- **`chargerOptions` contract** (decision 6): `regionCodes` optional; the staff form still sends it.
- **`ComboboxField` server search** is unused so far; the picker is its first consumer — B7 may need
  a `loading` / empty-state fix in the field (one file, its test).
- **15-file cap**: A7 and B4 split their component tests into a second commit; B5 is at 13, B7
  at 14.
- **`GeneralStatus` beside `StaffStatus`**: the same three values twice; merging is a later contract
  change, not this ticket.
- **A 停止 or deleted client keeps its branches** (legacy: no rule): they stay listed under the
  client's name; `client.options` offers non-deleted clients only, so no new branch joins a deleted
  one. A rule (refuse deleting a client with branches, or cascade the status) is the user's call.
- Open: the number pre-check for branches (decision 9, default no); the staff-style detail toolbar
  (decision 11, default no); 担当者 filtered by the client's regions (decision 6, default no); a
  client-with-branches delete rule (default none, as the legacy).

## Out of scope

- CSV upload / update / download / history; print; `image`; data migration from MySQL; the
  branch-change notification; 担当者 history for clients; workflow links; a request body limit
  (API-wide follow-up from the staff ticket).

## Log

- 2026-10-08 — plan drafted (planner role done inline, as on the staff and settings tickets).
- 2026-10-08 — self-review before approval: the `Branch` subject helpers moved from A3 to B1b (the
  model does not exist in phase A); both forms return to the list as the legacy (not to the detail
  as the staff form); the Messages table pins the legacy toasts and dialog texts; the branch
  form's 地域 offers every region until an エリア is chosen; `kanaSchema` takes a max (the names are
  100 wide); one include for the branch reads so the client detail's dialog renders the list's row;
  `ClientOption` lives in the branches feature; the client detail's 編集 is an inline button; counts
  fixed (A8 4, B7 14); the client-with-branches delete rule is an open point.
- 2026-10-08 — the discord-alerts session's commit `78401e9` landed on this branch (shared working
  tree); its ADR took number 0010, so this ticket's ADR is `0011-clients-and-branches.md`. The
  branch reset is left to the user (Risks).
- 2026-10-08 — approved ("ok heregjuul"). `git reset --hard b3a1f29` hit the repository's deny rule
  and `git switch -c … develop` was denied by auto mode (it would remove the stray commit's files
  from the working tree), so the work continues on this branch and removing `78401e9` stays with the
  user (Risks). The plan keeps the name `plan-client-branch.md` because `plan.md` is the alerts plan
  in `78401e9`.
- 2026-10-09, A1–A10: as planned, with these differences. A2's `findChargerIds` left in A5: the
  detail read carries the 担当者, and an update compares against it. A4's `CHARGERS_MAX` and a
  shared `chargerUserIdsSchema` came with their first consumer in A5
  (`user.schema.ts`). クライアント名 sorts by its reading (`nameKana`), as the legacy branch list
  sorted its names; the legacy client list sorted the kanji. A6 adds `addressLineOf` beside
  `postCodeLabel` (the staff contact card had it inline; the client list and detail and the branch
  screens show the same). The client form's 地域 follows エリア through `HierarchyFields`, as the
  staff form, where the legacy client form offered every region whatever the エリア. A9 keeps
  `ChargerChoice` in `types.ts` and the legacy save message in `client-labels.ts`
  (`clientSaveErrorOf`, both containers). The browser check shortened the search label
  to 番号・名前・担当者で検索 (`364d37d`): the longer one was cut off in the box.
- 2026-10-09, phase A browser check (admin through every flow; super_admin, manager and AM on the
  list, row menu, detail and create page): create through the two steps (twice), the
  taken クライアント番号 kept on its field at 次へ, detail rows, edit, status change from the row
  menu, delete of the 停止 rows through the toolbar, search by number, the filter popover; manager
  and AM get 詳細 only and the 403 on create. No console error. The dev database
  keeps 検証クライアント408649 and 検証クライアント496854改.
- 2026-10-09, B1–B8: as planned, with these differences. `chargerNamesOf` moved to
  `lib/charger-labels.ts` before the branch list (`1157ca1`, its second feature). B5 is one
  `BranchDetail` component (the four cards) instead of four card files, as the legacy BranchDetail
  served the page and the dialog; `BranchRow` equals `BranchDetail`, so the dialog renders the
  list's row. The legacy detail's 店舗名（カタカナ） is labelled 就業先名（カタカナ）, as its form;
  the toast 就業先部署店作成 drops its stray 店. B7 is two commits (values, steps and save message;
  then the form, containers and pages); the client search and the next number are queries in
  `BranchForm`, as the staff form's 担当者 lookup, so `client-picker-field.tsx` was not needed — the
  picker is a `ComboboxField` with `onSearch` and `serverFiltered`. A branch of a client deleted
  since stays editable: the client is checked only when the branch joins it.
- 2026-10-09, phase B browser check (admin through every flow; super_admin, manager and AM on the
  list, row menu, detail, create page and the client detail's dialog): the client chosen by search
  fills 就業先番号 (1, then 2), a 就業先番号 the client uses is the legacy message on save, the list
  sorted by client, the four detail cards, edit where another エリア drops the 地域, status and
  delete, the client detail's table and its dialog. The only console line is the expected 409 of the
  taken-number check. The dev database keeps 検証店605541 (関西) under 検証クライアント408649.
- 2026-10-09 — verifier PASS: `yarn verify --force` 40/40 tasks (1250 tests), the schema drift gate
  "No difference detected", both migrations deployed to the 5433 dev database. Security pass
  (protocol Step 6, by hand): every procedure sits behind `requireAbility`, no raw SQL, no
  `dangerouslySetInnerHTML`, the client URL renders as text; the list filters' arrays are unbounded
  as on the staff list, and the API body limit stays the staff ticket's follow-up.
- 2026-10-09 — review round 1 (REQUEST_CHANGES: 2 BLOCKER, 4 SHOULD, 6 NIT) and its fixes:
  - BLOCKER, router tests: an AM's update, changeStatus, deleteMany and number lookups are
    FORBIDDEN, an admin updates (`3a9f83b`); the permission spec proves `accessibleClientsWhere` and
    `accessibleBranchesWhere` match no row without the grant (`3a9f83b`), and `accessibleStaffWhere`
    too, for a uniform spec (`c0107c8`).
  - BLOCKER, missing tests: the save-error helpers were tested, inside the form-input tests; the
    cases move beside their label files (`e297f37`).
  - SHOULD, the next number: a refetch on window focus overwrote a typed 就業先番号. It is written
    once per chosen client, never from an earlier choice's cache (`2afc09b`).
  - SHOULD, the client detail's branches page by 10, as the legacy `take` 10 (`60d7fb4`;
    the 担当者 it also put in that table's search label went again in round 2).
  - SHOULD, the Legacy → new table: two rows added (the lists' whole
    address; 地域 following エリア in the client form).
  - SHOULD, the Log: the A and B entries above carry the differences (no `client-picker-field.tsx`,
    one `BranchDetail`, `charger-labels` and `addressLineOf`, the client checked only when a branch
    joins it).
  - SHOULD, `.claude/rules/ui.md` described a domain picker with a `byId` lookup, living in the
    feature that owns the data, which another feature cannot import. It now describes the
    lookup-prop picker the branch form uses, and the feature-screen skill points to it.
  - SHOULD, the double-click guard copied into the staff, client and branch forms moves into
    `useStepper` (`cce9f63`).
  - NIT, the chosen client's name: the chosen client stays on offer (`2afc09b`). Checking it in the
    browser showed a worse bug: once a client was chosen, a new search snapped back to its name
    after the debounce, on create and on edit. `ComboboxField` built a new selected option on every
    render, and Base UI writes the chosen label back whenever the value changes identity (`e2000c2`,
    with the field's first test).
  - NIT, the save-error toast: kept as the reference `comment-template-dialog.tsx` does it (a
    mutation with its own `onError` shows only its message, without the global
    toast's エラーが発生しました title). Follow-up for the three: a message per error code in the
    mutation's `meta`, read by the `MutationCache`.
  - NIT, the branch list's search label: kept; one naming 担当者 is cut off (266–280 px of text in a
    244 px box at 1440 px).
  - NIT, rules: `module-template.md` records the guards that take a transaction client first,
    `permissions.md` the Prisma models and the where helpers its spec covers, `testing.md`
    `clientInput` and `branchInput`.
  - NIT, the number rule races under READ COMMITTED (two saves of one number can both pass the
    count): a follow-up together with the staff rule's identical gap (an advisory lock per number,
    or Serializable).
- 2026-10-09 — browser re-check of the fixes as super_admin, admin, manager and AM: the client
  detail's 就業先部署情報 asks for 10 a page (all four roles); the branch form fills 2
  for 検証クライアント408649, keeps a typed 77 through a window-focus refetch after 30 s, keeps a
  search typed over the chosen client and fills 1 for 検証クライアント496854改; the edit form keeps
  a typed search and puts the stored client back on Escape; the client and staff forms' 次へ still
  shows the field errors (super_admin and admin). No console error.
- 2026-10-09 — review round 2 of `217b436..25c7849` (REQUEST_CHANGES: 0 BLOCKER, 2 SHOULD, 4 NIT)
  and its fixes:
  - SHOULD, nothing tested `gcTime: 0`, and a disabled query still reads the cache: an edit form
    mounted right after a create form had looked up the same client filled the edited
    branch's 就業先番号 with that answer (a test mounting both on one QueryClient showed 8 over 3).
    The fill is now create only (`7d10544`), and two tests pin it: a client chosen again is asked
    again (A, B, A fills 8, 3 and 9; without `gcTime: 0` the second A shows the cached 8), and an
    edit form after a create form keeps its number.
  - SHOULD, the client detail's search label named 担当者, but that table's 担当者名 column shows
    the 連絡担当者 while the search matches the 担当者 users: back to 番号・名前で検索 (`c04a060`).
  - NIT: `.claude/rules/permissions.md` and `server.ts` said CASL returns a marker condition Prisma
    rejects; it returns `{ OR: [] }` (`8caaafb`). The router tests' titles name the update and the
    stepper's guard test renders in StrictMode (`3e29729`); the chosen-client test waits for the
    re-search instead of 400 ms (`7d10544`).
  - Browser re-check: the label as all four roles; as super_admin and admin, the create page fills 2
    for 検証クライアント408649 and the edit page of 検証店605541 opened right after keeps 1. No
    console error.
  - The protocol's two review rounds are used up, so these fixes were not reviewed a third time.
- 2026-10-09 — what slowed the ticket: two sessions on one working tree (the alerts commit on this
  branch, the refused reset and switch); commitlint's subject-case (a subject may not start with a
  PascalCase word); lint-staged's `--max-warnings 0`, which `yarn verify` does not apply (a ref-name
  warning passed verify and failed the commit); vitest fork workers timing out once under load
  (re-run green); Context7 unavailable (it needs authentication), so the repo's own patterns served
  for the library APIs.
- 2026-10-09, Close: the plan moves to `docs/plans/2026-10-08-client-branch.md`. The ticket is the
  39 commits after `78401e9`, each green on `yarn verify`; nothing is pushed and `develop` is
  untouched. Phase A was not fast-forwarded before phase B began, as the plan meant, because the
  stray commit `78401e9` (the alerts session's) sits under both: before any fast-forward of
  `develop` the user drops it (`git rebase --onto b3a1f29 78401e9`), or merges PR #1 first if that
  merge keeps the commit (no squash). The dev database on 5433 keeps the browser
  checks' 検証クライアント408649, 検証クライアント496854改 and 検証店605541 (関西). The session's
  dev servers (web 3000, API 4000) are stopped.

# Plan: Staff — スタッフ管理 (list, detail, create, update) with user profiles, reference data and address

Ticket: `feature/D_ROUND-TBD_staff`. Status: **draft 2026-10-08, awaiting approval** — every
decision below names its reference; the user may override any of them. Confirmed by the user on
2026-10-08: `staffs` stays a separate aggregate (decision 1) and the `staff` role key is renamed to
`am` first (decision 19, commit A0). Three phases, each a set of commits that is green on its own
(`yarn verify`), browser-checked and fast-forwarded into `develop` before the next starts (≤15 files
per commit; A0 is the named exception).

Read before this plan — legacy API: `d-round-api/src/database/schema/staff/staff.prisma`,
`user/users.prisma`, `source/address.prisma`, `source/sourceHierarchy.prisma`, `enums.prisma`,
`src/graphql/resolvers/staff/{queries,mutations,helpers}.ts`, `resolvers/source/queries.ts`
(`getChargerUsers`), `resolvers/user/{queries,mutations}.ts` (the `staff` profile of a user,
`getUserStaffs`), `src/graphql/schema/{staff,source,user}.ts`, `src/helpers/address.ts`; legacy web:
`d-round-web/src/features/staff/**` (`StaffForm`, `StaffFormStep1/2`, `StaffFormConfirm`,
`RelatedWorkflow`, `StaffColumns`, `StaffsToolbar`, `StaffFilterContent`, `StaffsContainer`,
`StaffsTable`, `detail/*`, `schema/index.ts`, `store`, `context`, `hooks/*`),
`features/user/components/form/UserForm*.tsx`,
`features/user/components/list/{UserColumns,filter/UserFilterContent}.tsx`,
`features/user/components/detail/UserStaffs.tsx`, `features/user/schema/index.ts`,
`shared/components/form/{Address,Steps}.tsx`,
`shared/hooks/{useFormStepper,useSourceHierarchies,useValidateEntityNumber,useFormCookieValues}.tsx`,
`shared/lib/address/index.ts`, `shared/lib/schemas/addressSchemas.ts`, `shared/lib/enums/values.ts`;
structure reference romuten-v3 `apps/web/src/components/common/Stepper.tsx`, `hooks/useStepper.ts`,
`features/worker/create/{containers/WorkerCreateContainer.tsx,schemas/worker-steps.schema.ts}`,
`components/form/AddressField.tsx`,
`packages/database/prisma/{branch/branchAddress,source/sourceAddress,auth/user}.prisma`; this repo:
`apps/web/features/users` (skill `feature-screen`), `features/comment-templates`,
`docs/plans/2026-10-07-user-feature.md` (decisions 2, 3, 4, 5), `docs/plans/2026-10-08-settings.md`
(decision 7), ADR 0002 / 0003 / 0005 / 0006.

## Goal and acceptance criteria

Port the legacy スタッフ管理 feature and, with it, the pieces the legacy kept on the shared `Staff`
table or in `shared/`: the 担当者 (user) profile fields
(社員番号, 部署名, 役職, 退職日, エリア, 地域), the reference-data API (regions, prefectures,
postal-code lookup), the address field, the area → region → prefecture → 担当者 cascade, multi-value
filters and the form stepper — all reusable by the client and branch tickets.

- `/admin/master/user`: the deferred legacy
  columns 社員番号 (before 氏名), エリア, 地域 (after メールアドレス);
  filters エリア, 地域, 役職 next to アカウントタイプ / ステータス; numeric search matches 社員番号;
  sortable by 社員番号. 担当者追加 and 担当者情報編集 carry the profile fields; the detail shows
  them and a 担当スタッフ card (legacy `UserStaffs`). A user may not edit their own profile fields.
- `/admin/staff`: toolbar (検索, filter, 削除 of the selected 停止 rows, スタッフ追加); table with
  select, スタッフ番号, スタッフ名 (+ reading), 担当者, エリア, 地域, 支店名, ステータス, row
  actions (詳細 / 編集 / ステータス変更 / 削除 — 削除 only for a 停止 row);
  filters ステータス, 性別, エリア, 地域, 県名, 雇用区分; sortable by スタッフ番号, スタッフ名;
  everything in the URL.
- `/admin/staff/[id]`: スタッフ情報, 住所・連絡先情報, 在籍情報 (with the 担当者 of each
  period), 家族情報, メモ; toolbar 編集 / ステータス変更 / 削除 by ability.
- `/admin/staff/create`, `/admin/staff/update/[id]`: the legacy three-step form
  (基本情報 → 家族情報・メモ → 確認) on a reusable `Stepper`, with the address filled from the
  postal code, the cascade, 在籍情報 / 家族情報 rows, the five fixed メモ plus custom ones
  with 定型文 buttons, a confirm summary, and キャンセル / 戻る / 次へ / 追加・保存 at the bottom.
- Every procedure has `requireAbility`; services throw domain errors; the data layer is
  testcontainers-tested; `yarn verify` green per commit; every screen opened as super_admin, admin,
  manager and AM (`am`, the renamed `staff` role) next to the legacy screen.
- The role catalog reads `super_admin | admin | manager | am`; `am@test.com` replaces
  `staff@test.com`; nothing else about who may do what changes (same grants, same labels).

## Decisions (each names its reference; the user may override any of them at approval)

1. **Users keep no `Staff` row; their HR fields live in `user_profiles` (1:1 with `users`), and
   `staffs` holds only スタッフ.** The legacy `Staff{employeeType: USER}` row per user made every
   user query a join and every staff query a filter. Reference: the Staff / User discussion of
   2026-10-07 (user-feature plan, decision 2), migrations.md "auth/ stays Better Auth's;
   `auth/user.prisma` only gains relation fields", Better Auth docs (core user table + own tables
   for domain data).
2. **姓 / 名 / セイ / メイ stay on `users`, not in `user_profiles`.** They define Better Auth's
   `name` ("姓 名"), which the session, the mails and every user label read without a join; the
   charger picker and the staff list show them. `user_profiles` holds what Better Auth never reads
   (社員番号, 部署名, 役職, 退職日, エリア, 地域). Reference: ADR 0002 (2026-10-07 line), romuten-v3
   `auth/user.prisma` (`name`, `nameKana` on the user row). Alternative — move the four columns to
   the profile — rejected: a second migration of data added yesterday and a join for every name.
3. **エリア as an enum array, 地域 / 都道府県 as join tables keyed by the natural `code`.**
   `areas source_area[]` is a closed set the database checks (ADR 0006 precedent:
   `comment_templates.types` replaced a MySQL join table). Regions and prefectures reference seeded
   rows, so they keep a foreign key: `staff_regions`, `staff_prefectures`, `user_profile_regions`
   with composite primary keys over `(owner_id, code)`, `onDelete: Cascade` to the owner and
   `Restrict` to the reference row (ADR 0005 "relations and lookups use code"; migrations.md
   join-table exception, "index every foreign key"). Alternative — `Int[]` code arrays with
   `hasSome` — rejected: no integrity check, every consumer needs a code → name map.
4. **The user gets エリア and 地域, not 都道府県.** The legacy user form (`UserFormStep1`,
   `staffSchema` in `features/user/schema`) and `WhereUserInput` have `areas` and `regionCodes`
   only; the charger picker filters by region. The staff gets all three (legacy `StaffFormStep1`).
   Adding 都道府県 to users is one more join table and a form field the legacy never had — not built
   unless asked.
5. **Address: `staff_addresses` (1:1) with `post_code` → `source_addresses` and one typed line; the
   lookup is our own master, not zipaddress.net.** `source.addressByPostCode` reads the seeded Japan
   Post master (ADR 0005, 2026-10-05: "`post_code` is the lookup and future relation key"); the form
   fills 都道府県 / 市区町村 / 町域 from it and the user types 番地・建物名 (`address1`). Legacy
   stored the auto-filled text twice (`address1` = pref+city+town, `address2` = typed); here the
   resolved parts come from the relation. References: legacy `StaffAddress` + `createAddress`,
   romuten-v3 `branchAddress.prisma` + `AddressField.tsx` (query `sourceAddress(zipCode)`). The
   field is `AddressFields` under `apps/web/components/source/` (app level: several features use it
   and features never import each other — ui.md; romuten-v3 keeps it in `components/form/`). Named
   after the owner (`staff_addresses`), as legacy and romuten-v3; a later user address would be
   `user_addresses` with the same shape — the legacy user form has no address.
6. **担当者 (chargers): `staff_chargers(staff_id, user_id, assigned_at, unassigned_at)` — history by
   closing, not deleting; options from `user.chargerOptions({ regionCodes })`.** Verified in the
   legacy `StaffForm`: `areas` change → regions, prefectures, chargers reset; `regionCodes` change →
   `chargerUsers({ regionCodes })` refetched and chargers reset; `prefectureCodes` change → chargers
   reset. `getChargerUsers` returns non-deleted, non-SUPER_ADMIN users whose profile regions
   overlap, ordered by kana. The legacy snapshot columns (`userEmail`, `userName`, `userNameKana`)
   existed because users could be deleted; here users are soft-deleted only, so the row keeps
   `user_id` with `Restrict`. `unassigned_at` replaces `changedAt` + `userId: null` and keeps
   the 在籍情報 担当者 column (legacy `chargePersonNames`: chargers assigned during the employment
   period).
7. **A hard-coded `read Source` rule for reference data.** `source.regions`, `source.prefectures`,
   `source.addressByPostCode` need `requireAbility` (permissions.md: a non-public procedure without
   it is a BLOCKER) and no catalog row fits; as the personal `CommentTemplate` rule (ADR 0003,
   2026-10-08), `defineRules` adds `can("read", "Source")` for every signed-in user, `Source` joins
   `SUBJECT_NAMES`, the unit spec gets its rows. Route access is unaffected (no page).
8. **Staff status `ACTIVE | INACTIVE | SUSPENDED` (利用中 / 保留 / 停止) plus `deleted_at`.** Legacy
   `EnumGeneralStatus` mixed a state (`DELETE` = 停止) with a deletion marker (`DELETED`, number
   scrambled by `encryptInt`). Here 停止 is a state and スタッフ削除 is a soft delete allowed only
   for a 停止 row (legacy `StaffColumns.isDeleteAble`, `deleteStaffs where status DELETE`). The list
   defaults to 利用中 + 保留 (legacy `status not DELETE`) and never shows deleted rows. Status
   changes from a row action / toolbar button into `StaffStatusDialog` (radio + 変更), not an inline
   select (user-feature decision 3).
9. **スタッフ番号 uniqueness among non-deleted staff is a service rule; 社員番号 is a database
   unique.** A deleted staff frees the number (legacy scrambled it to allow reuse); a partial unique
   index Prisma cannot express (ADR 0006), so `staff.create` / `update` check
   `countActiveByEmployeeNumber` inside the transaction (legacy `staffHelpers.exists`) and
   `staff.employeeNumberAvailable` lets the form refuse step 1 early (legacy
   `useValidateEntityNumber`). Users are never hard-deleted and a 停止 user keeps their number, so
   `user_profiles.employee_number` is `@unique`.
10. **`staff.update` takes the whole form; children are replaced in one transaction, chargers are
    diffed.** Family members, memos and job histories are small arrays nobody references; a per-row
    diff (legacy `updateStaff` upserts by id) buys nothing. Chargers keep history (decision 6), so
    removed ones are closed and new ones added. Deviation from feature-screen §4 ("update sends only
    what changed") named here: a three-step form with nested arrays has no cheap change set.
11. **One zod schema and a `Stepper` from romuten-v3, not per-step schemas.** Legacy swapped the
    resolver per step (`createStaffSchema[step]`); romuten-v3 validates the step's field list with
    `trigger` (`hooks/useStepper.ts`, `worker-steps.schema.ts`) over one schema — the API's. New
    composed `Stepper` (`packages/ui/.../composed/stepper.tsx`, presentational: labels, current
    index, completed steps clickable as legacy `Steps`) and `useStepper` (`packages/ui/src/hooks/`).
    The confirm step is a `DescriptionList` summary (legacy `StaffFormConfirm`); the actions are
    `FormActions` in a `StickyBar` (feature-screen §4).
12. **Dropped or deferred legacy pieces** (each with its own ticket where
    noted): 関連申請書を紐付け (`RelatedWorkflow`, the dialog on create — workflow ticket), CSV
    upload / download / history, 履歴書 upload (`resume`, `FormUploadInputField` — file-upload
    ticket), `Stamp` (the legacy `UserForm` schema requires `stamp` but renders no field and `''`
    passes `z.string()`: dead; file-upload ticket), プロフィール画像 (`image`), print (`onPrint` is
    a no-op), the cookie draft dialog作業中の情報の続きから入力を再開しますか？ (`useCookieValues` +
    `js-cookie` + crypto; not asked for, a dependency without a second consumer), `nextStaffNumber`
    / `staffByEmployeeNumber` (no UI consumer), `birthday` list filter (never rendered), `createdBy`
    / `updatedBy` columns (audit log ticket). 年齢 stays as a computed read-only field.
13. **メモ: five fixed slots plus custom rows; only memos with text are stored.** Legacy created the
    five typed memos with empty content. Here the form always
    shows スタッフメモ / 入退社情報 / 住所変更 / 保険関係 / その他 (filled from the stored rows) and
    lets custom rows (`CUSTOM`, titled メモ) be added; `toCreateInput` drops empty ones.
    The 定型文 buttons come from `commentTemplate.list({ type: "STAFF", perPage: 100 })` through the
    app-level `CommentTemplateShortcuts` (settings plan decision 7: the picker arrives with its
    first consumer; app level because the workflow comment will use it too).
14. **Multi-value filters as repeated URL parameters.** Legacy filtered by several statuses, areas,
    regions, prefectures, employee types, genders, positions at once (`CheckboxSection`,
    `MultiSelectSection`). `withParams` already writes arrays; `parseSearchParams` learns to read a
    `ZodArray` field with `getAll`. Two new composed controls: `CheckboxGroup` (standalone twin of
    `CheckboxGroupField`, for the short sets ステータス / 性別 / エリア) and `MultiOptionSelect`
    (standalone twin of `MultiSelectField`, for 地域 / 県名 / 雇用区分 / 役職); the two fields wrap
    them as `SelectField` wraps `OptionSelect` (ui.md Promotion rule).
15. **Cascade and hierarchy pieces at app level, `apps/web/components/source/`.**
    `useSourceHierarchy` (regions + prefectures, `staleTime: Infinity`), pure `hierarchy-options.ts`
    (`regionOptions(regions, areas)`, `prefectureOptions(prefectures, regionCodes)`,
    `distinctAreas(regions)`), `HierarchyFields` (form: エリア → 地域 → optional 都道府県, resets
    children on change with `useWatch` + `setValue`, as legacy `form.register(..., { onChange })`),
    `HierarchyFilterFields` (filter popover sections), labels `AREA_LABELS`. Users and staff
    features import from there; neither imports the other (ui.md).
16. **`staff.byId` returns the staff with address, regions, prefectures, chargers, family members,
    job histories and memos.** Legacy paged each child list separately (10 per page); the lists are
    a handful of rows, so the detail cards are `DataTable`s without pagination.
17. **The user profile is required on 担当者追加 and on 担当者情報編集**, as every profile field was
    required in the legacy `UserFormStep1`. Existing users have no profile row: the list shows `—`,
    the update form asks for it (as it did for the name parts). Profile changes need the catalog's
    `update User`, not the self row rule: the service checks an unconditional rule (`canUnscoped` on
    the server ability) so a staff user cannot edit their own 社員番号 or 役職.
18. **Three phases, each fast-forwarded when green.** A: the role rename (A0), reference data API,
    user profiles, the reusable filter / cascade pieces, the user screens. B: the staff aggregate,
    API, list and detail, the 担当スタッフ card. C: the stepper and the staff form. Each phase ends
    with its screens browser-checked as every role; the plan stays `plan.md` on this branch until
    phase C closes.
19. **The `staff` role key becomes `am` before anything else (A0); スタッフ never become users in
    this ticket, and the path to a staff login is one nullable column.** The current `staff` role is
    the legacy `EnumUserRole.STAFF`, labelled AM everywhere (`ROLE_LABELS.staff = "AM"`); keeping
    that key would collide with a future login role for スタッフ. Renaming now, before production
    data, is one `UPDATE "roles" SET key = 'am'` — `users.role` and `role_permissions.role_key`
    follow through their `ON UPDATE CASCADE` foreign keys (`20261005090103`, `20261005143913`) —
    plus the new column default. Grants and labels do not change (`permissions.csv` column renamed,
    same flags). Why スタッフ are not users with a `staff` role (the alternative the user raised):
    Better Auth's `users` needs a unique `email` and the legacy staff email is optional; the
    lifecycles differ (利用中 / 保留 / 停止 / 削除 vs 利用中 / 停止; スタッフ番号 vs 社員番号); the
    catalog separates `Admin_User` from `Admin_Staff`, which one table would turn into
    role-conditioned User rules; and the admin plugin's user count, ban and session logic would
    apply to people who never sign in. The legacy itself kept `Staff` apart with an optional
    `Staff.userEmail → User` link; Odoo's `hr.employee.user_id` is the same shape. When staff must
    sign in: add `staffs.user_id String? @unique` (expand-only), a `staff.invite` procedure (Better
    Auth `createUser` with a new `staff` role and a required email at that moment) and a
    `permissions.csv` column for that role — no restructuring, no data migration. Not built now (no
    consumer); the path is recorded in ADR 0008 Consequences.

## Legacy → new

| Legacy piece (file)                                                                                                                                | New                                                                                                                                              | Kept / changed / dropped — why                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `EnumUserRole.STAFF` (label AM) → this repo's `staff` role key, `staff@test.com`                                                                   | role key `am` (name / nameJp `AM`), `am@test.com`; `staff` reserved for a future スタッフ login role                                             | changed — decision 19 (A0)                                                      |
| `Staff.userEmail? → User.email` (optional account link, used only for USER rows)                                                                   | — (`staffs.user_id?` when a staff login is required)                                                                                             | deferred — decision 19                                                          |
| `Staff{employeeType: USER}` row per user (`image`, `employeeNumber`, `departmentName`, `retirementDate`, `position`, `areas`, `regions`)           | `user_profiles` + `user_profile_regions`; `image` dropped                                                                                        | changed — decision 1; image with the file-upload ticket                         |
| `user.staff.{lastName, firstName, lastNameKana, firstNameKana}`                                                                                    | `users.last_name …` (already there)                                                                                                              | kept on `users` — decision 2                                                    |
| `Staff` (non-USER) + `StaffAreas`, `SourceRegionOnStaffs`, `SourcePrefectureOnStaffs`                                                              | `staffs.areas source_area[]`, `staff_regions`, `staff_prefectures`                                                                               | changed — decision 3                                                            |
| `Staff.{retirementDate, departmentName, image, resume, createdBy, updatedBy}`                                                                      | —                                                                                                                                                | dropped — user-only or deferred (decision 12)                                   |
| `StaffAddress(postCode, address1 auto, address2 typed)` + `lib/address` (zipaddress.net) + `AddressSchema`                                         | `staff_addresses(post_code FK, address1 typed)`; `source.addressByPostCode`; `addressSchema` / `addressFormSchema` in `@repo/validation`         | changed — decision 5                                                            |
| `StaffCharger(userEmail, userName, userNameKana, userId?, changedAt)`                                                                              | `staff_chargers(user_id FK, assigned_at, unassigned_at)`                                                                                         | changed — decision 6                                                            |
| `FamilyMember`, `Memo`, `JobHistory`                                                                                                               | `staff_family_members`, `staff_memos` (non-empty only), `staff_job_histories`                                                                    | kept — decision 13 for memos                                                    |
| `Stamp`                                                                                                                                            | —                                                                                                                                                | deferred — decision 12 (dead in the legacy form)                                |
| `EnumGeneralStatus ACTIVE / INACTIVE / DELETE / DELETED`, `encryptInt` on delete                                                                   | `staff_status ACTIVE / INACTIVE / SUSPENDED` + `deleted_at`                                                                                      | changed — decision 8                                                            |
| `EnumEmployeeType` (with `USER`), `EnumGender`, `EnumPosition`, `EnumFamilyRelation`, `EnumStaffMemoType`, `EnumArea`                              | `employee_type` (without `USER`), `gender`, `position`, `family_relation`, `staff_memo_type`; `source_area` (exists)                             | kept — Japanese labels from `shared/lib/enums/values.ts` in `utils/*-labels.ts` |
| `staffs(where{search, areas, regions, prefectures, statuses, employeeTypes, genders, birthday}, orderBy, take, skip)` → `{data, count}`            | `staff.list({ search?, statuses, genders?, areas?, regionCodes?, prefectureCodes?, employeeTypes?, sortBy, sortOrder, page, perPage })`          | changed — `PageResult`; `birthday` dropped (never rendered)                     |
| `staff(id)`, `staffConnection(id)`, `staffMemos / staffFamilyMembers / staffJobHistories(id, take, skip)`                                          | `staff.byId({ staffId })` with children                                                                                                          | changed — decision 16                                                           |
| `createStaff(StaffCreateInput)`, `updateStaff(StaffCreateInput)`                                                                                   | `staff.create`, `staff.update` (full payload)                                                                                                    | kept — decision 10                                                              |
| `updateStaffStatus` (inline `Select` + `DialogAlert` 該当スタッフのステータスを変更いたします)                                                     | `staff.changeStatus({ staffId, status })`; `StaffStatusDialog` from the row menu / detail toolbar                                                | changed — decision 8                                                            |
| `deleteStaff(id)`, `deleteStaffs(ids)` (`≥50` refused, `DELETE` rows only)                                                                         | `staff.deleteMany({ staffIds: 1–50 })` — soft delete, 停止 rows only (`ConflictError` otherwise)                                                 | changed — one mutation; the rule in the service                                 |
| `staffNumberExists`, `nextStaffNumber`, `staffByEmployeeNumber`                                                                                    | `staff.employeeNumberAvailable({ employeeNumber, excludeStaffId? })`; the other two dropped                                                      | changed — decision 9                                                            |
| `chargerUsers(where{search, areas, regionCodes, prefectureCodes})` (source resolver)                                                               | `user.chargerOptions({ regionCodes })` → `{ id, name, lastNameKana, firstNameKana }[]` (≤200, kana order, no super_admin, active)                | changed — lives on the user router; only `regionCodes` was used                 |
| `getSourceRegions`, `getSourcePrefectures`, `useSourceHierarchies`                                                                                 | `source.regions`, `source.prefectures`, `useSourceHierarchy` (`components/source/`)                                                              | kept — decision 7, 15                                                           |
| `userStaffs(id)` + `UserStaffs` card (grouped by region, rows open `StaffDetailDialog`)                                                            | `staff.byCharger({ userId })` + `UserStaffsCard` (grouped by region, rows link to the staff detail page)                                         | kept — dialog → link (the detail page exists)                                   |
| `WhereUserInput{areas, regions, positions}`, numeric search on `staff.employeeNumber`, `sortBy employeeNumber`                                     | `user.list` gains `areas`, `regionCodes`, `positions`, numeric search on 社員番号, `sortBy: "employeeNumber"`                                    | kept                                                                            |
| `UserColumns` 社員番号 (sortable) / エリア / 地域 (scrollable cell)                                                                                | columns in the slots kept by user-feature decision 2; 地域 as a wrapping list of names                                                           | kept — scroll-in-cell dropped (wrap)                                            |
| `UserFormStep1` 社員番号 / 姓 名 / セイ メイ / エリア / 地域 / 部署名 / 役職 / メール ×2 / アカウントタイプ / 退職日 / 権限 / プロフィール画像     | `UserFormFields` + `UserProfileFields` (社員番号 `NumberField`, 部署名, 役職 `SelectField`, 退職日 `DateField`, `HierarchyFields` エリア / 地域) | kept — image dropped                                                            |
| `UserFilterContent` ステータス / エリア / 地域 / 役職 / アカウントタイプ                                                                           | `UserFilterContent` + エリア (`CheckboxGroup`), 地域, 役職 (`MultiOptionSelect`)                                                                 | kept                                                                            |
| `UserDetailContainer` profile rows                                                                                                                 | 基本情報 gains 社員番号 / 部署名 / 役職 / 退職日 / エリア / 地域                                                                                 | kept                                                                            |
| `StaffColumns`: select, スタッフ番号, スタッフ名, 担当者 (scrollable), エリア, 地域, 支店名, ステータス `Select`, actions                          | `DataTable` rowSelection + the same columns; `StaffStatusBadge`; `StaffRowActions` 詳細 / 編集 / ステータス変更 / 削除 (停止 only)               | kept — select → badge + dialog (decision 8)                                     |
| `StaffsToolbar`: 検索, filter, `CsvMenus`, `CsvDownloadDialog`, 削除 (when `statuses` has `DELETE`), スタッフ追加                                  | `ListToolbar`: `SearchInput` (スタッフ番号・氏名・フリガナで検索), `StaffFilter`, 削除 (rows selected and 停止 filtered), スタッフ追加; CSV TODO | kept minus CSV (decision 12)                                                    |
| `StaffFilterContent` ステータス / 性別 / エリア (`CheckboxSection`), 地域 / 県名 / 雇用区分 (`MultiSelectSection`), `FilterContentWrapper`         | `StaffFilterContent` with `CheckboxGroup`, `HierarchyFilterFields`, `MultiOptionSelect`; `FilterTags` under the toolbar                          | kept — decision 14                                                              |
| Detail `StaffInfo` (+2 chargers then `+n 登録中`), `StaffContact` + `Toolbar` (編集 / 削除 / print / CSV), `StaffJobHistories` (担当者 column)     | `StaffInfoCard`, `StaffContactCard`, `StaffDetailToolbar` (編集 / ステータス変更 / 削除), `StaffJobHistoryTable` (`chargersDuring`)              | kept — print / CSV dropped; chargers listed in full                             |
| Detail `StaffFamilyMembers` (paged), `StaffMemos`, `StaffResume`                                                                                   | `StaffFamilyTable`, `StaffMemosCard`; resume dropped                                                                                             | kept minus resume (decision 12)                                                 |
| `StaffForm` (`STEP1 / STEP2 / CONFIRM`, per-step schemas, `FormSteps` with `react-circular-progressbar`, `useFormStepper`)                         | `StaffForm` on `Stepper` + `useStepper`, one `staffFormSchema`                                                                                   | changed — decision 11                                                           |
| `StaffFormStep1`: スタッフ情報登録 card, 住所・連絡先情報登録 card (`FormAddressField`, phones, email), 在籍情報 accordion, ファイルをアップロード | `StaffFormStepBasic`: three cards; `AddressFields`; `ArrayField` rows for 在籍情報 (`StaffJobHistoryFields`); upload card dropped                | kept — accordion → rows (`ArrayField`)                                          |
| `StaffFormStep2`: 家族情報登録 accordion + 家族情報を追加, メモ accordion (fixed five + custom, template buttons) + メモを追加                     | `StaffFormStepFamily`: `ArrayField` 家族情報 (`StaffFamilyMemberFields`), `StaffMemoFields` (fixed + custom) with `CommentTemplateShortcuts`     | kept — decision 13                                                              |
| `StaffFormConfirm` (`InfoRow` grids per card)                                                                                                      | `StaffFormConfirm` (`DescriptionList` per card)                                                                                                  | kept                                                                            |
| `RelatedWorkflow` 関連申請書を紐付け (opens on create)                                                                                             | —                                                                                                                                                | deferred — workflow ticket                                                      |
| `useCookieValues` 作業中の情報の続きから入力を再開しますか？                                                                                       | —                                                                                                                                                | dropped — decision 12                                                           |
| Fixed bottom bar キャンセル / 戻る + 次へ / 追加 / 保存                                                                                            | `StickyBar` + `FormActions` (`submitLabel` per step)                                                                                             | kept                                                                            |
| `useValidateEntityNumber` (staff number check before step 2)                                                                                       | `staff.employeeNumberAvailable` called in `useStepper.goNext` of step 1                                                                          | kept — decision 9                                                               |
| `store/index.ts` (`selectedStaffs` Map + `rowSelection`) + `context/`                                                                              | `stores/staffs-store.ts` (`rowSelection`) + provider (`createRowSelectionStore` shared with users / comment templates — third copy)              | changed — ui.md state order; settings plan risk "third list extracts the store" |
| `useStaffVariables`, `types/index.ts`, `useDeleteStaff(s)`, `useUpdateStaffStatus`                                                                 | `parseSearchParams(listStaffsSchema)`, `types.ts` from `AppRouter`, mutations inside the dialogs                                                 | changed — URL state through the API schema; one caller each                     |

## Schema changes

FLAG — three new schema folders and relation fields on existing models. Migrations are expand-only
(new enums, new tables, new foreign keys). ADRs: new `docs/adr/0007-user-profiles.md` (decisions 1,
2, 4, 17), new `docs/adr/0008-staff.md` (decisions 3, 5, 6, 8, 9, 10, 13, 16), one `## Changes` line
in `docs/adr/0003-permissions.md` (decision 7) and one in `docs/adr/0002-auth.md` (the name parts
stay on `users`, decision 2). Dev database 5433: `yarn db:migrate` (deploy), never `migrate dev`
(`local-dev-environment`).

### Phase A0 — the role key

`auth/user.prisma`: `role String @default("am")`. Migration `rename_staff_role_to_am`, hand-written
after `migrate dev` generates the default change:

```sql
-- The role catalog row 'staff' (legacy EnumUserRole.STAFF, labelled AM) becomes 'am'. users.role and
-- role_permissions.role_key follow through ON UPDATE CASCADE (20261005090103, 20261005143913); a
-- database already renamed updates 0 rows. 'staff' is kept free for a future スタッフ login role.
UPDATE "roles" SET "key" = 'am', "name" = 'AM', "name_jp" = 'AM', "updated_at" = CURRENT_TIMESTAMP
  WHERE "key" = 'staff';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'am';
```

A fresh database still gets `staff` from `20261005143913` and renames it here, so a migrations-only
database (testcontainers, CI) ends with the four keys `super_admin | admin | manager | am`. The
migrations.md rule "renames are drop + add" is about columns on tables with data; this is a key
value with cascading foreign keys, no column changes shape.

### Phase A — `profile/`

```prisma
// profile/user-profile.prisma
/// 役職 (legacy EnumPosition), shared with staffs.
enum Position {
  EXECUTIVE AREA_MANAGER DISTRICT_MANAGER SV LEADER DISPATCH_COORDINATOR FULL_TIME_EMPLOYEE
  AREA_EMPLOYEE CONTRACT_EMPLOYEE SUBCONTRACT_STAFF DISPATCH_STAFF STAFF OTHER
  @@map("position")
}

/// A 担当者's HR fields (legacy Staff{employeeType: USER}); one row per user, created on invite.
model UserProfile {
  id             String       @id @default(uuid(7)) @db.Uuid
  userId         String       @unique @map("user_id") @db.Uuid
  employeeNumber Int          @unique @map("employee_number")          // 社員番号
  departmentName String       @map("department_name") @db.VarChar(80) // 部署名
  position       Position
  retirementDate DateTime?    @map("retirement_date") @db.Date         // 退職日
  areas          SourceArea[]                                           // エリア
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  user    User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  regions UserProfileRegion[]
  @@map("user_profiles")
}

// profile/user-profile-region.prisma — 地域 of a 担当者 (legacy SourceRegionOnStaffs for USER rows)
model UserProfileRegion {
  userId     String       @map("user_id") @db.Uuid
  regionCode Int          @map("region_code")
  createdAt  DateTime     @default(now()) @map("created_at")
  profile UserProfile  @relation(fields: [userId], references: [userId], onDelete: Cascade)
  region  SourceRegion @relation(fields: [regionCode], references: [code], onDelete: Restrict)
  @@id([userId, regionCode])
  @@index([regionCode])
  @@map("user_profile_regions")
}
```

`auth/user.prisma` gains `profile UserProfile?` and (phase B) `staffCharges StaffCharger[]`;
`source/source-region.prisma` gains `userProfileRegions UserProfileRegion[]` and (phase B)
`staffRegions StaffRegion[]`. Migration `add_user_profiles`. `users.seed.ts` gives the four test
accounts a profile (社員番号 1–4, 部署名, 役職, エリア / 地域) so the list shows data; its test
counts follow.

### Phase B — `staff/`

```prisma
// staff/staff.prisma
enum EmployeeType { EXECUTIVE FULL_TIME PART_TIME CONTRACT OTHER  @@map("employee_type") } // 雇用区分, no USER
enum Gender       { MALE FEMALE OTHER                              @@map("gender") }
enum StaffStatus  { ACTIVE INACTIVE SUSPENDED                      @@map("staff_status") }   // 利用中 保留 停止

model Staff {
  id                   String       @id @default(uuid(7)) @db.Uuid
  employeeType         EmployeeType @map("employee_type")
  employeeNumber       Int          @map("employee_number")                       // スタッフ番号 (decision 9)
  lastName             String       @map("last_name") @db.VarChar(80)
  firstName            String       @map("first_name") @db.VarChar(80)
  lastNameKana         String       @map("last_name_kana") @db.VarChar(80)
  firstNameKana        String       @map("first_name_kana") @db.VarChar(80)
  gender               Gender
  birthday             DateTime?    @db.Date
  position             Position?
  branchName           String?      @map("branch_name") @db.VarChar(100)          // 支店名
  email                String?      @db.VarChar(255)
  phoneNumber          String?      @map("phone_number") @db.VarChar(20)
  emergencyPhoneNumber String?      @map("emergency_phone_number") @db.VarChar(20)
  areas                SourceArea[]
  status               StaffStatus  @default(ACTIVE)
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")
  deletedAt            DateTime?    @map("deleted_at")
  address       StaffAddress?
  regions       StaffRegion[]
  prefectures   StaffPrefecture[]
  chargers      StaffCharger[]
  familyMembers StaffFamilyMember[]
  memos         StaffMemo[]
  jobHistories  StaffJobHistory[]
  @@index([employeeNumber])
  @@index([status])
  @@index([lastNameKana, firstNameKana])
  @@map("staffs")
}
```

Nullable where the legacy column was nullable (the form requires 生年月日, 役職, 支店名, 電話番号 —
zod enforces it; a later port of legacy rows must not fail on an old row). The four name columns are
`NOT NULL` as the legacy form required them (risk noted below).

```prisma
// staff/staff-address.prisma — decision 5
model StaffAddress {
  id        String   @id @default(uuid(7)) @db.Uuid
  staffId   String   @unique @map("staff_id") @db.Uuid
  postCode  String   @map("post_code") @db.VarChar(7)       // digits only; formatted in the UI
  address1  String   @db.VarChar(200)                         // 番地・建物名 (legacy address2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  staff         Staff         @relation(fields: [staffId], references: [id], onDelete: Cascade)
  sourceAddress SourceAddress @relation(fields: [postCode], references: [postCode], onDelete: Restrict)
  @@index([postCode])
  @@map("staff_addresses")
}

// staff/staff-region.prisma, staff/staff-prefecture.prisma — decision 3 (same shape as user_profile_regions)
model StaffRegion     { staffId String @map("staff_id") @db.Uuid; regionCode Int @map("region_code"); createdAt …
                        staff Staff @relation(…, onDelete: Cascade); region SourceRegion @relation(fields: [regionCode], references: [code], onDelete: Restrict)
                        @@id([staffId, regionCode]) @@index([regionCode]) @@map("staff_regions") }
model StaffPrefecture { staffId; prefectureCode Int @map("prefecture_code"); createdAt …
                        prefecture SourcePrefecture @relation(fields: [prefectureCode], references: [code], onDelete: Restrict)
                        @@id([staffId, prefectureCode]) @@index([prefectureCode]) @@map("staff_prefectures") }

// staff/staff-charger.prisma — decision 6
model StaffCharger {
  id           String    @id @default(uuid(7)) @db.Uuid
  staffId      String    @map("staff_id") @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  assignedAt   DateTime  @default(now()) @map("assigned_at")
  unassignedAt DateTime? @map("unassigned_at")                 // null = current 担当者
  createdAt    DateTime  @default(now()) @map("created_at")
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  @@index([staffId])
  @@index([userId])
  @@map("staff_chargers")
}

// staff/staff-family-member.prisma
enum FamilyRelation { HUSBAND WIFE FATHER MOTHER FATHER_IN_LAW MOTHER_IN_LAW GRANDFATHER GRANDMOTHER
  ELDEST_SON SECOND_SON THIRD_SON ELDEST_DAUGHTER SECOND_DAUGHTER THIRD_DAUGHTER GRANDCHILD NEPHEW NIECE
  UNCLE AUNT PARENTAL_UNCLE PARENTAL_AUNT GREAT_GRANDFATHER GREAT_GRANDMOTHER  @@map("family_relation") }
model StaffFamilyMember { id; staffId; lastName, firstName @db.VarChar(80); lastNameKana?, firstNameKana?;
                          relation FamilyRelation?; birthday DateTime? @db.Date; createdAt; updatedAt
                          staff … Cascade  @@index([staffId]) @@map("staff_family_members") }

// staff/staff-memo.prisma — decision 13
enum StaffMemoType { STAFF_MEMO ENTRY_EXIT ADDRESS_CHANGE INSURANCE OTHER CUSTOM  @@map("staff_memo_type") }
model StaffMemo { id; staffId; memoType StaffMemoType @map("memo_type"); content String; createdAt; updatedAt
                  staff … Cascade  @@index([staffId]) @@map("staff_memos") }

// staff/staff-job-history.prisma
model StaffJobHistory { id; staffId; hireDate DateTime @map("hire_date") @db.Date; resignationDate DateTime? @map("resignation_date") @db.Date;
                        resignationReason String? @map("resignation_reason"); createdAt; updatedAt
                        staff … Cascade  @@index([staffId]) @@map("staff_job_histories") }
```

`source/source-address.prisma` gains `staffAddresses StaffAddress[]`,
`source/source-prefecture.prisma` gains `staffPrefectures StaffPrefecture[]`. Migration
`add_staffs`.

## Validation (`@repo/validation`)

- `source.schema.ts` (A): `SOURCE_AREAS = ["EAST", "WEST"]`, `sourceAreaSchema`, `regionCodeSchema`
  / `prefectureCodeSchema` (`z.coerce.number().int().positive()` — URL and form values are strings),
  `postCodeSchema` (`"123-4567"` or `"1234567"` → 7 digits, error 正しい郵便番号を入力してください,
  legacy `ZipCodeSchema`), `formatPostCode` / `stripPostCode`,
  `addressSchema = { postCode, address1 (住所を入力してください, ≤200) }`,
  `addressFormSchema = addressSchema.extend({ pref, city, town: z.string().optional() })` (display
  fields the form carries, stripped by `toCreateInput`), `addressByPostCodeSchema`.
- `user.schema.ts` (A): `POSITIONS`, `positionSchema`,
  `userProfileSchema = { employeeNumber (z.number().int().min(1), 社員番号は必須です), departmentName (部署名, ≤80), position, retirementDate (z.iso.date().nullable().optional()), areas (min 1, エリアを選択してください), regionCodes (min 1, 地域を選択してください) }`;
  `inviteUserSchema` and `inviteUserFormSchema` gain `profile: userProfileSchema`;
  `updateUserSchema` gains `profile: userProfileSchema.optional()` (the whole profile when any of it
  changed); `listUsersSchema` gains `areas`, `regionCodes`, `positions` (arrays, optional) and
  `USER_SORT_FIELDS` gains `"employeeNumber"`; `chargerOptionsSchema = { regionCodes: min 1 }`.
- `staff.schema.ts` (B): `EMPLOYEE_TYPES`, `GENDERS`, `STAFF_STATUSES`, `FAMILY_RELATIONS`,
  `STAFF_MEMO_TYPES`, `FIXED_MEMO_TYPES` (the five, in legacy order), `STAFF_DELETE_MAX = 50`,
  `phoneSchema` (the legacy `PhoneSchema` regex from `shared/lib/schemas`), `staffIdSchema`,
  `jobHistorySchema` (`hireDate` 入社日を入力してください, `resignationDate?`,
  `resignationReason?`), `familyMemberSchema` (姓 / 名 required ≤80, kana optional katakana,
  `relation` nullable, `birthday?`), `memoSchema` (`memoType`, `content` ≤2000), `createStaffSchema`
  (every step-1 field with the legacy
  messages: 雇用区分を選択してください, スタッフ番号は必須です, 姓 / 名 / セイ / メイ via
  `userNameSchema`, エリア / 地域 / 都道府県 / 担当者を選択してください, 生年月日を入力してください, 性別を選択してください,
  `address: addressSchema`, `phoneNumber: phoneSchema`, `emergencyPhoneNumber?`,
  `email?`, 役職を選択してください, 支店名を入力してください, `jobHistories`, `familyMembers`,
  `memos`), `staffFormSchema = createStaffSchema.extend({ address: addressFormSchema })`,
  `updateStaffSchema = createStaffSchema.extend({ staffId })`, `changeStaffStatusSchema`,
  `deleteStaffsSchema` (1–50), `employeeNumberAvailableSchema`, `listStaffsSchema` (`search?`,
  `statuses` default `["ACTIVE", "INACTIVE"]`, `genders?`, `areas?`, `regionCodes?`,
  `prefectureCodes?`, `employeeTypes?`, `sortBy: employeeNumber | name | createdAt` default
  `employeeNumber asc`), `staffsByChargerSchema`. Schema tests for the transforms (post code, memo
  filtering happens in the web util, not here).

## API

- `source` module (A): repository `source.repository.ts` (`findRegions`, `findPrefectures`,
  `findAddressByPostCode`), service with `requireAbility("read", "Source")` at layer 1 and nothing
  stateful, router `sourceRouter { regions, prefectures, addressByPostCode }`.
- `user` module (A): `findById` / `findMany` / `findByEmail` include
  `profile: { include: { regions } }` (`UserWithProfile`); `upsertProfile(userId, data)`,
  `replaceProfileRegions(userId, codes)` (deleteMany + createMany pair),
  `findChargerOptions(where, take)`. Service: `invite` writes the profile and its regions in the
  existing transaction; `update` upserts the profile when `input.profile` is given, after
  `assertUnscoped(ctx, "update", "User")` (decision 17); `list` adds the filters
  (`profile: { areas: { hasSome } }`, `profile: { regions: { some: { regionCode: { in } } } }`,
  `profile: { position: { in } }`), the numeric search (`profile: { employeeNumber: n }`) and the
  relation sort (`profile: { employeeNumber: order }` with `nulls: "last"`); `chargerOptions`
  (`requireAbility("read", "User")`; active, role ≠ `super_admin`, regions overlap, kana order,
  200). `UserDetail` and the list rows carry `profile` (type change for `apps/web`).
- `staff` module (B): repository `staff.repository.ts` — `findById` (children included),
  `findMany(params, where, orderBy)` (regions, current chargers with their user), `create(data)`
  (one `staff.create` with nested address / regions / prefectures / chargers / children),
  `update(id, data)` (one `staff.update` with nested `address.upsert`, `regions` / `prefectures` /
  `familyMembers` / `memos` / `jobHistories` `deleteMany: {}` + `create`),
  `closeChargers(staffId, userIds)` (`updateMany unassignedAt`), `addChargers(staffId, userIds)`
  (`createMany`), `countActiveByEmployeeNumber(number, excludeId?)`, `updateStatus`,
  `softDeleteMany(ids)` → count, `findManyByCharger(userId)`. Service: `list`
  (`accessibleStaffWhere` + filters; `statuses` default; `deletedAt: null`), `getById`, `create` /
  `update` (one `withTransaction`: number rule → chargers exist and are active users
  (`ValidationError` 担当者が見つかりません otherwise) → write; `isForeignKeyViolation` on a region
  / prefecture / post code → `ValidationError`), `changeStatus` (no-op when equal), `deleteMany`
  (every row 停止 → soft delete; otherwise `ConflictError`), `isEmployeeNumberAvailable`,
  `listByCharger` (`read Staff`). Router `staffRouter` with `requireAbility` per catalog action
  (`create`, `read`, `update`, `status`, `delete`).
- `permissions` (A, B): `Source` in `SUBJECT_NAMES` + the rule (decision 7); `staffSubject`,
  `prismaStaffSubject`, `accessibleStaffWhere`, `ServerSubjects` with `Staff`; `canUnscoped` moved
  to a shared helper usable by both abilities (`rules-helpers.ts`) and re-exported from `server.ts`.

## Web

- `hooks/search-params.ts` (A): `parseSearchParams` reads a `ZodArray` field with `getAll` (each
  item through the element schema; invalid items dropped) — test rows.
- `packages/ui` (A): `composed/checkbox-group.tsx` (`CheckboxGroup`: `options`, `value: string[]`,
  `onValueChange`, `label`, `orientation`) and `composed/multi-option-select.tsx`
  (`MultiOptionSelect`: the chips combobox of `MultiSelectField` without the form binding;
  `options`, `value`, `onValueChange`, `label`, `placeholder`, `emptyMessage`, `max`, server-search
  props); the two fields wrap them, their tests stay green. (C): `composed/stepper.tsx` (`Stepper`:
  `steps: string[]`, `current`, `onStepClick?` for completed steps, `labels`),
  `hooks/use-stepper.ts` (`useStepper({ steps: FieldPath[][] })` → `current`,
  `goNext(trigger, beforeNext?)`, `goPrev`, `goTo`; `beforeNext` is the async step guard the number
  check uses) — jsdom tests.
- `apps/web/components/source/` (A): `use-source-hierarchy.ts`, `hierarchy-options.ts` (pure,
  node-tested), `source-labels.ts` (`AREA_LABELS`), `hierarchy-fields.tsx`
  (`HierarchyFields<TValues>`: `names: { areas, regionCodes, prefectureCodes? }`, resets children),
  `hierarchy-filter-fields.tsx` (エリア `CheckboxGroup`, 地域 / 県名 `MultiOptionSelect` narrowed by
  the selection). (C): `address-fields.tsx` (`AddressFields<TValues>`:
  `baseName`; 郵便番号 with 住所検索 button, auto lookup at 7 digits through
  `trpc.source.addressByPostCode`, read-only 都道府県 / 市区町村 / 町域, typed 住所; a miss
  shows 郵便番号が見つかりません under the field, legacy `POST_CODE_ERROR`).
  `apps/web/components/comment-template-shortcuts.tsx` (C):
  `CommentTemplateShortcuts({ type, onPick(content) })` — outline buttons per template, loads only
  when rendered.
- `features/users` (A): list columns (`employeeNumber` sortable
  before 氏名; エリア, 地域 after メールアドレス), `user-filter-content.tsx`
  (+ エリア / 地域 / 役職), `user-filters.ts` (array filters, tags), `user-labels.ts`
  (`POSITION_LABELS`), `components/form/user-profile-fields.tsx`, `user-form-fields.tsx` (renders
  them), create / update forms and `user-form-input.ts` (profile in the input; update sends the
  whole profile when it changed), detail 基本情報 rows, `components/detail/user-staffs-card.tsx` (B,
  replaces the 担当スタッフ half of `user-charges-placeholder.tsx`; 担当クライアント stays),
  `types.ts`; tests and fixtures updated.
- `features/staff` (B, C) — copies `features/users` file by file (feature-screen):

| Folder        | Files                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `containers/` | `staffs-container.tsx`, `staff-detail-container.tsx` (B); `staff-create-container.tsx`, `staff-update-container.tsx` (C)                                                                                                                                                                                                                                                                       |
| `components/` | `staff-status-badge.tsx`, `staff-status-dialog.tsx`, `staff-delete-dialog.tsx` (B)                                                                                                                                                                                                                                                                                                             |
| `…/list/`     | `staffs-table.tsx`, `staffs-toolbar.tsx`, `staff-filter.tsx`, `staff-filter-content.tsx` (`next/dynamic`), `staff-row-actions.tsx` (B)                                                                                                                                                                                                                                                         |
| `…/detail/`   | `staff-detail-toolbar.tsx`, `staff-info-card.tsx`, `staff-contact-card.tsx`, `staff-job-history-table.tsx`, `staff-family-table.tsx`, `staff-memos-card.tsx` (B)                                                                                                                                                                                                                               |
| `…/form/`     | `staff-form.tsx` (stepper, cards per step, actions), `staff-form-step-basic.tsx`, `staff-form-step-family.tsx`, `staff-form-confirm.tsx`, `staff-job-history-fields.tsx`, `staff-family-member-fields.tsx`, `staff-memo-fields.tsx` (C)                                                                                                                                                        |
| `stores/`     | `staffs-store.ts`, `staffs-store-provider.tsx` over a shared `apps/web/stores/row-selection-store.ts` (`createRowSelectionStore`, the third copy — users and comment templates switch to it in the same commit)                                                                                                                                                                                |
| `utils/`      | `staff-labels.ts` (雇用区分 / 性別 / ステータス / 役職 / 続柄 / メモ labels), `staff-filters.ts`, `staff-chargers.ts` (`chargersDuring(chargers, hireDate, resignationDate)`), `staff-age.ts` (`ageOf`), (C) `staff-steps.ts` (`STAFF_STEP_LABELS` 基本情報 / 家族情報・メモ / 確認, `STAFF_STEP_FIELDS`), `staff-form-input.ts` (`defaultValuesOf(staff?)`, `toCreateInput`, `toUpdateInput`) |
| `types.ts`    | `StaffRow`, `StaffDetail`, `ChargerOption`                                                                                                                                                                                                                                                                                                                                                     |

Pages `app/admin/staff/{page,[id]/page,create/page,update/[id]/page}.tsx` keep their `PageGuard` and
swap `PlaceholderPage` for the container.

## Files to touch (one table per commit)

### Phase A — role rename, reference data, user profiles, shared pieces

#### Commit A0 — `refactor(roles): rename the staff role key to am` (~38, see Risks)

One mechanical rename; every file is a one-word change except the migration and the seed CSV header.
The exact test list comes from `grep -rl '"staff"\|staff@test.com' apps packages` at implementation
(the `Role` type no longer accepts `"staff"`, so typecheck names every site).

| #      | File                                                                                                                                                                                                                                                                                                                                                       | Action | Layer      | Purpose                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------- |
| 1      | packages/validation/src/user.schema.ts                                                                                                                                                                                                                                                                                                                     | edit   | validation | `ROLES`, `DEFAULT_ROLE`, `ASSIGNABLE_ROLES` (`am` where `staff` was)                |
| 2      | packages/auth/src/access-control.ts                                                                                                                                                                                                                                                                                                                        | edit   | shared     | `roles.am` (`userAc.statements`)                                                    |
| 3      | packages/database/prisma/schema/auth/user.prisma                                                                                                                                                                                                                                                                                                           | edit   | database   | `@default("am")`                                                                    |
| 4      | packages/database/prisma/migrations/<ts>_rename_staff_role_to_am/migration.sql                                                                                                                                                                                                                                                                             | create | database   | the SQL above                                                                       |
| 5      | packages/database/prisma/seed/roles.seed.ts                                                                                                                                                                                                                                                                                                                | edit   | database   | `{ key: "am", name: "AM", nameJp: "AM" }`                                           |
| 6      | packages/database/prisma/seed/data/permissions.csv                                                                                                                                                                                                                                                                                                         | edit   | database   | header column `staff` → `am` (flags unchanged; the seed's header check enforces it) |
| 7      | packages/database/prisma/seed/users.seed.ts                                                                                                                                                                                                                                                                                                                | edit   | database   | `am@test.com`, role `am`                                                            |
| 8      | apps/web/features/users/utils/user-labels.ts                                                                                                                                                                                                                                                                                                               | edit   | web        | `ROLE_LABELS.am = "AM"`                                                             |
| 9      | apps/web/features/users/components/role-badge.tsx                                                                                                                                                                                                                                                                                                          | edit   | web        | `ROLE_TONES.am`                                                                     |
| 10     | apps/web/features/users/components/form/user-create-form.tsx                                                                                                                                                                                                                                                                                               | edit   | web        | preselect `"am"`                                                                    |
| 11     | apps/web/test/support/grants.ts                                                                                                                                                                                                                                                                                                                            | edit   | test       | `role: "am"`, `AM_GRANTS` (was `STAFF_GRANTS`)                                      |
| 12     | packages/permissions/test/ability.test.ts                                                                                                                                                                                                                                                                                                                  | edit   | test       | `holder` role `"am"`                                                                |
| 13     | apps/api/test/role-catalog.test.ts                                                                                                                                                                                                                                                                                                                         | edit   | test       | `"am"` is the default and the catalog key                                           |
| 14     | packages/database/test/seed/{roles,permissions,users}.seed.test.ts                                                                                                                                                                                                                                                                                         | edit   | test       | keys, `am@test.com`                                                                 |
| 15–~35 | every other test with `role: "staff"` / `"staff"` / `staff@test.com` (apps/api `user.service`, `user.router`, `comment-template.*`, `permission.*`, `permission-catalog`, `auth-http`; packages/database repositories; apps/web users / comment-templates fixtures and component tests, `role-field-state.test.ts`, `nav.test.ts`, `route-access.test.ts`) | edit   | test       | literal → `"am"`                                                                    |
| ~36    | .claude/rules/permissions.md, .claude/rules/migrations.md                                                                                                                                                                                                                                                                                                  | edit   | docs       | role set and table, seed accounts, migration row (see Risks: `.claude` edits)       |
| ~37    | docs/adr/0002-auth.md                                                                                                                                                                                                                                                                                                                                      | edit   | docs       | `## Changes` line: `staff` → `am`, why (decision 19)                                |
| ~38    | docs/auth.md, README.md                                                                                                                                                                                                                                                                                                                                    | edit   | docs       | `am@test.com` where the accounts are listed                                         |

The dev database on 5433 takes the migration with `yarn db:migrate`; a running dev server keeps its
sessions (Better Auth reads `users.role` per request and the grants come from `role_permissions`,
both renamed by the cascade), and `yarn db:seed` converges the `am@test.com` account (the old
`staff@test.com` row stays as a fifth account unless deleted by hand — note in the commit).

#### Commit A1 — `feat(db): user_profiles and user_profile_regions; ADR 0007` (12)

| #   | File                                                                           | Action | Layer      | Purpose                                                                                     |
| --- | ------------------------------------------------------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------------------- |
| 1   | docs/adr/0007-user-profiles.md                                                 | create | docs       | decisions 1, 2, 4, 17 (before the migration — migrations.md workflow)                       |
| 2   | docs/adr/0002-auth.md                                                          | edit   | docs       | `## Changes` line: the name parts stay on `users` (decision 2)                              |
| 3   | packages/database/prisma/schema/profile/user-profile.prisma                    | create | database   | `Position`, `UserProfile`                                                                   |
| 4   | packages/database/prisma/schema/profile/user-profile-region.prisma             | create | database   | `UserProfileRegion`                                                                         |
| 5   | packages/database/prisma/schema/auth/user.prisma                               | edit   | database   | `profile UserProfile?`                                                                      |
| 6   | packages/database/prisma/schema/source/source-region.prisma                    | edit   | database   | `userProfileRegions UserProfileRegion[]`                                                    |
| 7   | packages/database/prisma/migrations/<ts>_add_user_profiles/migration.sql       | create | database   | generated, read before commit                                                               |
| 8   | packages/database/src/index.ts                                                 | edit   | database   | export `Position` (value), `UserProfile`, `UserProfileRegion` (types)                       |
| 9   | packages/database/src/repositories/user.repository.ts                          | edit   | repository | `UserWithProfile`, includes, `upsertProfile`, `replaceProfileRegions`, `findChargerOptions` |
| 10  | packages/database/test/repositories/user.repository.test.ts                    | edit   | test       | profile upsert / regions replace / charger options rows                                     |
| 11  | packages/database/prisma/seed/users.seed.ts (+ `test/seed/users.seed.test.ts`) | edit   | database   | a profile per test account                                                                  |
| 12  | .claude/rules/migrations.md                                                    | edit   | docs       | schema folder `profile/`, migrations table row (see Risks: `.claude` edits)                 |

#### Commit A2 — `feat(permissions): read Source rule, server canUnscoped` (7)

| #   | File                                      | Action | Layer  | Purpose                                                                                            |
| --- | ----------------------------------------- | ------ | ------ | -------------------------------------------------------------------------------------------------- |
| 1   | packages/permissions/test/ability.test.ts | edit   | test   | `Source` rows: every signed-in user reads, anonymous does not; `canUnscoped` on the server ability |
| 2   | packages/permissions/src/rules.ts         | edit   | shared | `"Source"` in `SUBJECT_NAMES`; `can("read", "Source")` after the grant loop                        |
| 3   | packages/permissions/src/rules-helpers.ts | create | shared | `canUnscoped` generic over both abilities (moved from `ability.ts`)                                |
| 4   | packages/permissions/src/ability.ts       | edit   | shared | re-export                                                                                          |
| 5   | packages/permissions/src/server.ts        | edit   | shared | `canUnscoped` export for the API                                                                   |
| 6   | packages/permissions/src/index.ts         | edit   | shared | exports                                                                                            |
| 7   | docs/adr/0003-permissions.md              | edit   | docs   | `## Changes` line (decision 7)                                                                     |

#### Commit A3 — `feat(api): source module — regions, prefectures, address by post code` (9)

| #   | File                                                                                                  | Action | Layer      | Purpose                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------- |
| 1   | packages/validation/src/source.schema.ts                                                              | create | validation | areas, codes, post code, address schemas, `formatPostCode` |
| 2   | packages/validation/src/index.ts                                                                      | edit   | validation | export                                                     |
| 3   | packages/validation/test/source.schema.test.ts                                                        | create | test       | post code transform, array coercion                        |
| 4   | packages/database/src/repositories/source.repository.ts                                               | create | repository | three reads                                                |
| 5   | packages/database/src/repositories/index.ts                                                           | edit   | repository | barrel                                                     |
| 6   | packages/database/test/repositories/source.repository.test.ts                                         | create | test       | seeded rows found; unknown post code → null                |
| 7   | apps/api/src/modules/source/source.service.ts                                                         | create | service    | `regions`, `prefectures`, `addressByPostCode`              |
| 8   | apps/api/src/trpc/routers/source.router.ts (+ `router.ts`)                                            | create | transport  | `requireAbility("read", "Source")`                         |
| 9   | apps/api/test/modules/source/source.service.test.ts, apps/api/test/trpc/routers/source.router.test.ts | create | test       | signed-in reads, anonymous `UNAUTHORIZED`                  |

#### Commit A4 — `feat(api): user profile on invite / update / byId / list; chargerOptions` (8)

| #   | File                                            | Action | Layer      | Purpose                                                                                                                                   |
| --- | ----------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | packages/validation/src/user.schema.ts          | edit   | validation | `userProfileSchema`, `positionSchema`, list filters, `chargerOptionsSchema`                                                               |
| 2   | packages/validation/test/user.schema.test.ts    | edit   | test       | profile rows                                                                                                                              |
| 3   | apps/api/src/modules/user/user.service.ts       | edit   | service    | profile in `invite` / `update` (unscoped check), filters, sort, `chargerOptions`                                                          |
| 4   | apps/api/src/trpc/routers/user.router.ts        | edit   | transport  | `chargerOptions`                                                                                                                          |
| 5   | apps/api/test/modules/user/user.service.test.ts | edit   | test       | invite writes a profile; a staff user cannot change their own profile; filters; 社員番号 conflict → `CONFLICT`; charger options by region |
| 6   | apps/api/test/trpc/routers/user.router.test.ts  | edit   | test       | `chargerOptions` forbidden for staff                                                                                                      |
| 7   | apps/api/test/support.ts                        | edit   | test       | `signedInUser` may take a `profile`                                                                                                       |
| 8   | .claude/rules/permissions.md                    | edit   | docs       | `Source` rule, `canUnscoped` on the server (see Risks)                                                                                    |

#### Commit A5 — `feat(ui): CheckboxGroup and MultiOptionSelect; fields wrap them` (8)

| #   | File                                                              | Action | Layer | Purpose                                             |
| --- | ----------------------------------------------------------------- | ------ | ----- | --------------------------------------------------- |
| 1   | packages/ui/test/components/composed/checkbox-group.test.tsx      | create | test  |                                                     |
| 2   | packages/ui/test/components/composed/multi-option-select.test.tsx | create | test  |                                                     |
| 3   | packages/ui/src/components/composed/checkbox-group.tsx            | create | ui    | standalone                                          |
| 4   | packages/ui/src/components/composed/multi-option-select.tsx       | create | ui    | standalone chips combobox                           |
| 5   | packages/ui/src/components/form/checkbox-group-field.tsx          | edit   | ui    | wraps `CheckboxGroup`                               |
| 6   | packages/ui/src/components/form/multi-select-field.tsx            | edit   | ui    | wraps `MultiOptionSelect`                           |
| 7   | packages/ui/src/components/composed/README.md                     | edit   | docs  | two entries                                         |
| 8   | .claude/rules/ui.md                                               | edit   | docs  | composed list, `components/source/` row (see Risks) |

#### Commit A6 — `feat(web): array search params; source hierarchy pieces` (9)

| #   | File                                                      | Action | Layer | Purpose                                               |
| --- | --------------------------------------------------------- | ------ | ----- | ----------------------------------------------------- |
| 1   | apps/web/test/hooks/search-params.test.ts                 | edit   | test  | arrays                                                |
| 2   | apps/web/hooks/search-params.ts                           | edit   | web   | `ZodArray` → `getAll`                                 |
| 3   | apps/web/test/components/source/hierarchy-options.test.ts | create | test  | pure helpers                                          |
| 4   | apps/web/components/source/hierarchy-options.ts           | create | web   | `regionOptions`, `prefectureOptions`, `distinctAreas` |
| 5   | apps/web/components/source/source-labels.ts               | create | web   | `AREA_LABELS` 東日本 / 西日本                         |
| 6   | apps/web/components/source/use-source-hierarchy.ts        | create | web   | two queries, `staleTime: Infinity`, maps              |
| 7   | apps/web/components/source/hierarchy-fields.tsx           | create | web   | form cascade with resets                              |
| 8   | apps/web/components/source/hierarchy-filter-fields.tsx    | create | web   | filter sections                                       |
| 9   | apps/web/test/components/source/hierarchy-fields.test.tsx | create | test  | changing エリア clears 地域 / 都道府県 (StrictMode)   |

#### Commit A7 — `feat(web): user list columns and filters for 社員番号 / エリア / 地域 / 役職` (10)

| #    | File                                                                                                                                                                                  | Action | Layer | Purpose                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------- |
| 1    | apps/web/features/users/types.ts                                                                                                                                                      | edit   | web   | `UserRow` with `profile`                                    |
| 2    | apps/web/features/users/utils/user-labels.ts                                                                                                                                          | edit   | web   | `POSITION_LABELS`, `areaNamesOf`, `regionNamesOf`           |
| 3    | apps/web/features/users/utils/user-filters.ts                                                                                                                                         | edit   | web   | `areas`, `regionCodes`, `positions`, tags                   |
| 4    | apps/web/features/users/components/list/users-table.tsx                                                                                                                               | edit   | web   | the three columns                                           |
| 5    | apps/web/features/users/components/list/user-filter-content.tsx                                                                                                                       | edit   | web   | `HierarchyFilterFields`, 役職 `MultiOptionSelect`           |
| 6    | apps/web/features/users/components/list/users-toolbar.tsx                                                                                                                             | edit   | web   | search label 社員番号・氏名・フリガナ・メールアドレスで検索 |
| 7–10 | apps/web/test/features/users/{fixtures.ts, utils/user-filters.test.ts, utils/user-labels.test.ts, components/list/users-table.test.tsx, components/list/user-filter-content.test.tsx} | edit   | test  |                                                             |

#### Commit A8 — `feat(web): user profile fields on invite / edit, profile rows on the detail` (11)

| #    | File                                                                                                                                                                                                       | Action | Layer | Purpose                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------------- |
| 1    | apps/web/features/users/components/form/user-profile-fields.tsx                                                                                                                                            | create | web   | 社員番号, 部署名, 役職, 退職日, `HierarchyFields` (エリア / 地域) |
| 2    | apps/web/features/users/components/form/user-form-fields.tsx                                                                                                                                               | edit   | web   | renders them                                                      |
| 3    | apps/web/features/users/components/form/user-create-form.tsx                                                                                                                                               | edit   | web   | defaults                                                          |
| 4    | apps/web/features/users/components/form/user-update-form.tsx                                                                                                                                               | edit   | web   | defaults from `profile`                                           |
| 5    | apps/web/features/users/utils/user-form-input.ts                                                                                                                                                           | edit   | web   | profile in both inputs; whole profile when changed                |
| 6    | apps/web/features/users/containers/user-detail-container.tsx                                                                                                                                               | edit   | web   | 基本情報 rows                                                     |
| 7–11 | apps/web/test/features/users/{utils/user-form-input.test.ts, components/form/user-form-fields.test.tsx, components/form/user-create-form.test.tsx, components/form/user-update-form.test.tsx, fixtures.ts} | edit   | test  | StrictMode; an untouched edit form keeps 保存 disabled            |

#### Commit A9 — `docs: user profiles, source module, shared pieces` (≤5)

`README.md` folder map (`components/source/`, `source` module),
`.claude/skills/feature-screen/SKILL.md` (filters with arrays, `HierarchyFilterFields`),
`docs/auth.md` untouched. Then phase A browser check and fast-forward.

### Phase B — staff aggregate, API, list, detail

#### Commit B1 — `feat(db): staffs and children; ADR 0008` (14)

| #   | File                                                                                                                                                                   | Action | Layer      | Purpose                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------- |
| 1   | docs/adr/0008-staff.md                                                                                                                                                 | create | docs       | decisions 3, 5, 6, 8, 9, 10, 13, 16                 |
| 2–8 | packages/database/prisma/schema/staff/{staff, staff-address, staff-region, staff-prefecture, staff-charger, staff-family-member, staff-memo, staff-job-history}.prisma | create | database   | models above                                        |
| 9   | packages/database/prisma/schema/{auth/user, source/source-region, source/source-prefecture, source/source-address}.prisma                                              | edit   | database   | relation fields                                     |
| 10  | packages/database/prisma/migrations/<ts>_add_staffs/migration.sql                                                                                                      | create | database   | generated, read before commit                       |
| 11  | packages/database/src/index.ts                                                                                                                                         | edit   | database   | enums (values) and model types                      |
| 12  | packages/database/src/repositories/staff.repository.ts (+ barrel)                                                                                                      | create | repository | methods listed under API                            |
| 13  | packages/database/test/repositories/staff.repository.test.ts                                                                                                           | create | test       | nested create / update, charger close / add, counts |
| 14  | .claude/rules/migrations.md                                                                                                                                            | edit   | docs       | folder `staff/`, migration row                      |

#### Commit B2 — `feat(permissions): Staff subject helpers` (5)

`ability.ts` (`staffSubject`), `server.ts` (`prismaStaffSubject`, `accessibleStaffWhere`,
`ServerSubjects`), `index.ts`, `test/ability.test.ts` (rows for `Staff`: grant-driven only, no row
rule), `docs/adr/0003-permissions.md` (one line).

#### Commit B3 — `feat(api): staff module` (9)

`packages/validation/src/staff.schema.ts` + test + index,
`apps/api/src/modules/staff/staff.service.ts`, `apps/api/src/trpc/routers/staff.router.ts` +
`router.ts`, `apps/api/test/modules/staff/staff.service.test.ts` (create with
children; スタッフ番号 taken → `ConflictError`, freed by a deleted staff; unknown region →
`ValidationError`; update replaces children and closes / adds chargers; delete refuses 利用中;
manager cannot create; list filters and default statuses; `byCharger`),
`apps/api/test/trpc/routers/staff.router.test.ts` (codes), `apps/api/test/support.ts` (a
`createStaff(h, overrides)` helper).

#### Commit B4 — `feat(web): staff list — table, toolbar, filters, status and delete dialogs` (15)

`apps/web/stores/row-selection-store.ts` (+ test; users and comment-templates stores become thin
wrappers — 2 edits),
`features/staff/{types.ts, stores/*, utils/staff-labels.ts, utils/staff-filters.ts, components/staff-status-badge.tsx, components/staff-status-dialog.tsx, components/staff-delete-dialog.tsx, components/list/*}`,
`app/admin/staff/page.tsx`; tests for labels, filters, table, toolbar, row actions (as users). If
the count passes 15, the dialogs move to B5.

#### Commit B5 — `feat(web): staff detail and the 担当スタッフ card on the user detail` (13)

`features/staff/containers/staff-detail-container.tsx`, `components/detail/*`,
`utils/staff-chargers.ts` (+ test), `utils/staff-age.ts` (+ test), `app/admin/staff/[id]/page.tsx`,
`features/users/components/detail/user-staffs-card.tsx` (+ test), `user-charges-placeholder.tsx`
(担当クライアント only), `user-detail-container.tsx`.

#### Commit B6 — `docs: staff module, list and detail` (≤4)

README folder map, feature-screen skill (multi-state status dialog), ui.md (`apps/web/stores/`).
Phase B browser check and fast-forward.

### Phase C — the staff form

#### Commit C1 — `feat(ui): Stepper and useStepper` (6)

`composed/stepper.tsx`, `hooks/use-stepper.ts`, `composed/README.md`, `hooks/README.md`, two tests.

#### Commit C2 — `feat(web): AddressFields and CommentTemplateShortcuts` (5)

`components/source/address-fields.tsx` (+ test: typing 7 digits fills the read-only parts; a miss
shows the message), `components/comment-template-shortcuts.tsx` (+ test), ui.md row.

#### Commit C3 — `feat(web): staff form — basic step, address, job histories` (10)

`features/staff/utils/staff-steps.ts`, `utils/staff-form-input.ts` (+ tests: `defaultValuesOf`
builds the five fixed memos, `toCreateInput` drops empty memos and the address display fields),
`components/form/staff-form.tsx` (stepper, `FormActions` キャンセル / 戻る + 次へ / 追加 / 保存,
`beforeNext` of step 1 calls `staff.employeeNumberAvailable`),
`components/form/staff-form-step-basic.tsx`, `components/form/staff-job-history-fields.tsx`,
`containers/staff-create-container.tsx`, `app/admin/staff/create/page.tsx`, tests
(StrictMode; 次へ refused with the field errors).

#### Commit C4 — `feat(web): staff form — family, memos, confirm, update` (10)

`components/form/staff-form-step-family.tsx`, `staff-family-member-fields.tsx`,
`staff-memo-fields.tsx`, `staff-form-confirm.tsx`, `containers/staff-update-container.tsx` (loads
`staff.byId`, charger options for the stored regions), `app/admin/staff/update/[id]/page.tsx`, tests
(confirm shows the entered values; update sends the whole payload).

#### Commit C5 — `docs: staff form, stepper, address field` (≤5)

README, feature-screen skill §4 (stepped forms), ui.md (Stepper, hooks). Then protocol Step 6:
`/security-review`, MR description, plan to `docs/plans/2026-10-08-staff.md`.

## Tests to add or update

- A0: no new test; `role-catalog.test.ts` (parity of `ROLES`, the Better Auth map and the table on
  `am`), the seed tests and every `"staff"` literal switch to `am`. The migration is exercised by
  every testcontainers suite (`prisma migrate deploy` on a fresh database ends with `am`).
- `packages/database`: repository tests for `user` (profile), `source`, `staff`;
  `users.seed.test.ts`.
- `packages/permissions`: `Source` rows, `Staff` rows, server `canUnscoped`.
- `packages/validation`: `source.schema`, `user.schema` (profile), `staff.schema`.
- `apps/api`: `source` service + router; `user` service (profile on invite / update, self-profile
  forbidden, filters, charger options) + router; `staff` service + router;
  `permission-catalog.test.ts` stays green (`Source` is not a catalog row).
- `packages/ui`: `CheckboxGroup`, `MultiOptionSelect`, `Stepper`, `useStepper`; the two refactored
  fields' existing tests.
- `apps/web`: `search-params` arrays; `components/source/*`; `comment-template-shortcuts`; users
  (table, filters, forms, input util, labels, staffs card); staff (labels, filters, chargers, age,
  table, toolbar, row actions, status / delete dialogs, detail cards, form steps, confirm, input
  util, store); `route-tree.test.ts` unchanged (pages keep their guards).

## Steps (in order)

Each step: test first, then the code; `yarn lint`, `yarn typecheck`, the workspace's tests;
`yarn verify` before the commit. Context7 before writing: Prisma 7 nested writes with
`deleteMany: {}` + `create` in one `update`, relation `orderBy` with `nulls`, `hasSome` on enum
arrays; `@casl/prisma` with a third model in `Subjects`; Base UI Combobox chips (for
`MultiOptionSelect`); react-hook-form `trigger` with nested field paths (`useStepper`).

- **A0** role rename. `yarn db:migrate:dev --name rename_staff_role_to_am` against the throwaway
  database generates the default change; add the `UPDATE` by hand, read the SQL, `yarn db:generate`;
  then the code sites, then `yarn typecheck` names every remaining `"staff"` literal; `yarn verify`.
  Browser: sign in as `am@test.com`, the badge still reads AM, the sidebar and 403s unchanged.
- **A1** schema + ADR 0007 + repository + seed. Migration against the throwaway database
  (`yarn db:migrate:dev --name add_user_profiles`), read the SQL, `yarn db:generate`.
- **A2** rule + helper. **A3** source module. **A4** user module. `apps/web` typechecks against the
  new `AppRouter` (the `UserRow` type gains `profile`).
- **A5** ui controls. **A6** search params + `components/source/`. **A7** list. **A8** forms +
  detail.
- **A9** docs. Browser (super_admin, admin, manager, am on `/admin/master/user`, create, update,
  detail): columns, filters and tags, numeric search, sort by 社員番号, invite with a profile, edit
  an old user without one, 担当者 detail rows; an AM user's profile page unchanged. Fast-forward.
- **B1** schema + ADR 0008 + repository (`add_staffs`). **B2** helpers. **B3** API module.
- **B4** list. **B5** detail + staffs card. **B6** docs. Browser (four roles on `/admin/staff`,
  `/admin/staff/[id]`, and the 担当スタッフ card): select-all, filters (multi), status dialog,
  delete only on 停止, manager / AM see no edit or status actions; empty and error states.
  Fast-forward.
- **C1** stepper. **C2** address + shortcuts. **C3** basic step + create. **C4** family step +
  confirm + update. **C5** docs. Browser (admin on create and update, next to the legacy form): step
  validation, 次へ refused on a taken number, address lookup, cascade resets, chargers refetch on
  region change, job history / family rows add and remove, fixed memos with 定型文 buttons, confirm
  summary, 追加 / 保存, キャンセル / 戻る. Then protocol Step 6.

## Risks and open questions

- **Scope**: twenty commits in three phases. Each phase is mergeable on its own; if the user wants a
  smaller first MR, phase A alone closes the deferred user-feature items.
- **A0 exceeds the 15-file cap** (~38 files, ~25 of them tests): the `Role` type flows into every
  test that names a role, so a split leaves no green intermediate state (a two-step expand — add
  `am` beside `staff`, then remove `staff` — still touches every test in the second step). The
  reviewer reads it as one mechanical change; the exception is named here for approval.
- **A0 and the dev database**: the cascade renames `users.role` for every existing account, so the
  seeded `staff@test.com` user becomes an `am` user with the old email; `yarn db:seed` adds
  `am@test.com` beside it. Harmless; delete the old row by hand if two AM accounts confuse the
  browser checks (`local-dev-environment` note to update).
- **Auto mode denies `.claude/*` edits** (`agent-permissions`): the rows in A0, A1, A4, A5, B1, B6,
  C5 wait for the user to switch mode or apply them; the code commits do not depend on them.
- **Required profile on invite** (decision 17) changes an existing API contract: `inviteUserSchema`
  gains a required field. Nothing outside the web calls it; the invite form test changes with it.
  Alternative: optional profile — rejected, the legacy required every field.
- **`NOT NULL` kana on `staffs`**: a later port of legacy rows without kana must backfill or relax
  the column (expand-contract); the legacy form required them, CSV uploads may not have.
- **Prisma relation sort with `nulls`** (users without a profile sorted by 社員番号) and `hasSome`
  on an enum array: confirmed with Context7 in A1 / A4; fallback is a sort on `createdAt` when the
  relation sort is not supported by the generator.
- **`canUnscoped` on the server ability**: the current helper is typed for `AppAbility`; a generic
  over `Ability<[Action, S]>` must keep the unit spec green. Fallback: a second, server-typed copy.
- **Multi-select controls in filters**: `MultiOptionSelect` is extracted from `MultiSelectField`;
  the field's tests pin the behaviour so the extraction cannot change it.
- **Charger option size**: all active non-super_admin users of the selected regions (≤200); fine for
  one organisation. A search box on the picker is a later change if the list grows.
- **`staff.update` full payload** (decision 10): a concurrent edit overwrites silently, as legacy.
- **Store extraction** (`createRowSelectionStore`): touches the two existing features in B4; their
  store tests must stay green unchanged.
- **The dev database on 5433** must receive both migrations with `yarn db:migrate` (deploy).
- **15-file cap**: B1 and B4 are at 14–15; the splits are named in their tables.
- Open: 都道府県 on users (decision 4, default no); 停止 users keep their 社員番号 (decision 9,
  default yes); phase merges vs one MR (decision 18). Settled 2026-10-08: `staffs` stays a separate
  aggregate and the role rename is in scope (decision 19).

## Out of scope

- 関連申請書を紐付け (`RelatedWorkflow`), the workflow comment template picker consumer — workflow
  ticket.
- CSV upload / update / download / history for users and staff; print.
- File upload: 履歴書 (`resume`), プロフィール画像 (`image`), `Stamp` (印鑑) — file-upload ticket
  (the `FileField` exists, the storage side does not).
- Cookie draft resume (`useCookieValues`), `nextStaffNumber`, audit-log columns.
- 都道府県 on users; a user address; client / branch features (they reuse `AddressFields`,
  `HierarchyFields`, `MultiOptionSelect`, `Stepper`).
- A スタッフ login: the `staff` role for it, `staffs.user_id`, `staff.invite` (decision 19) — when
  the requirement arrives.
- Legacy data migration (MySQL → Postgres) for staff and profiles — its own ticket; the schema keeps
  the natural keys (`code`, `post_code`) it will need.

## Log

- 2026-10-08 — plan drafted (planner role done inline, as on the settings ticket).
- 2026-10-08 — the user asked why スタッフ are not users with a `staff` role and what happens when
  staff must sign in; answered with decision 19. The user confirmed `staffs` as a separate aggregate
  and added the role rename (`staff` → `am`) as commit A0.
- 2026-10-08 — approved by the user ("ok heregjuul") with every decision as written.
- 2026-10-08, start: the Docker Desktop API is hung (the socket does not answer `_ping`; the
  containers' ports accept TCP but Prisma cannot reach the dev database on 5433), as on 2026-10-07.
  Restarting Docker Desktop stops the romuten containers, so it is the user's call (notified). Until
  Docker answers, each commit runs every Docker-free check (lint, typecheck, build, format, the
  validation / permissions / ui / web tests); migrations are generated schema-to-schema
  (`prisma migrate diff --from-schema … --to-schema …`), and the testcontainers suites, the drift
  gate and the dev-database deploy run once Docker is back, before any phase is merged.
- 2026-10-08, A0–A3: as planned, with these differences. A0's migration inserts `am`, moves users
  and grants, then deletes `staff` (instead of one `UPDATE` of the key), so it also succeeds where
  the new roles seed ran first. A2 keeps `canUnscoped` in `ability.ts` with a structural parameter
  type and re-exports it from `server.ts` (no `rules-helpers.ts`), and its rule doc
  (`permissions.md`) moved from A4 into A2, beside the rule. A3 adds only the schemas its procedures
  use (areas, codes, post code); the address form schemas come with their first form (phase B/C).
  `startTestDatabase({ seedReferenceData: true })` now also loads regions and prefectures, so API
  and auth tests can write profiles.
- 2026-10-08, A4: `user.employeeNumberAvailable` added, as the legacy `userNumberExists`: the user
  forms ask before saving and show この社員番号は既に使用されています on the field (domain error
  details do not reach the client, and a message match would be brittle); the server still refuses a
  taken number (pre-check, then the unique index). `profile` is optional on invite until A8, where
  the form gains the fields and the form schema requires it. Region codes in forms and API inputs
  are plain numbers (`regionCodesSchema`, distinct and ascending), so the forms' zod input and
  output types stay equal; `MultiSelectField` gains `valueAs: "number"` in A5 (the legacy
  `useNumberOptions`); only the URL list filter coerces strings (`regionCodeSchema`).
- 2026-10-08, A5–A9: as planned, with these differences. A5's composed controls keep English
  defaults (the fields pass the Japanese ones). A6 gives `MultiSelectField` a `pruneToOptions` flag
  instead of effects in each form: once the options are authoritative it drops selected values they
  no longer offer, so a removed エリア also removes its 地域 and their 都道府県 (the legacy reset
  every child on any parent change; dropping only what the parent no longer covers keeps the rest);
  the filter's narrowing is a pure function (`narrowSelection`). エリア is a `CheckboxGroupField` /
  `CheckboxGroup` (two options, ui.md), not the legacy multi-select. A7 includes each region's name
  in user reads (no client lookup for the 地域 column); the filter order follows the legacy
  (ステータス, エリア, 地域, 役職, アカウントタイプ). A7 and A8 each went over the 15-file cap and
  were split before review: A7 into `ba462d2` (region names, numeric list parameters) and `99a0d09`
  (the list), A8 into `9475aa4` (the forms), `1032c80` (the detail rows) and `bc87609` (the API
  requires the profile on invite, after the form sends it). packages/ui re-exports
  react-day-picker's Japanese locale (`lib/calendar-locale`) for `DateField`. TanStack Query 5.102
  deprecates `fetchQuery`: the number pre-check uses `queryClient.query`.
- 2026-10-08, phase A status: implemented and green on every Docker-free check. Still open before
  the fast-forward: the testcontainers suites, the drift gate, the dev-database deploy of the three
  migrations and the browser check of the user screens as every role — all wait on the Docker
  Desktop API. Phase B starts meanwhile on this branch.
- 2026-10-08, B1–B3: B1 went over the 15-file cap and was split into `508287c` (schema, migration,
  ADR 0008) and `7604efa` (repository). B2 adds no browser `staffSubject`: Staff has no row rule, so
  the web asks `ability.can(action, "Staff")`. B3's test support builds the input (`staffInput`) and
  makes sure the test post code exists (`ensureTestPostCode`) instead of a `createStaff` helper; the
  tests create staff through the service.
- 2026-10-08, B4: the shared row selection came first (`45ddbbe`, `09885ca`:
  `apps/web/stores/row-selection.tsx`, a provider and a hook instead of per-feature wrappers), so
  `features/staff` has no `stores/`. The status dialog is a `ConfirmDialog` holding the legacy
  status select (`OptionSelect`: the legacy row held a select, and no standalone radio group
  exists); `ConfirmDialog` gained `children` and `confirmDisabled`. `StaffDeleteDialog` takes
  `onDeleted`, so the list unselects and the detail leaves; the list container renders the list
  inside its `RowSelectionProvider` to reach the store. The row menu's 削除 stays disabled
  until 停止 (legacy `isDeleteAble`), the toolbar's 削除 shows while 停止 is filtered (legacy
  `showDelete`), and the API's refusals are named (not 停止, over 50). `areaNamesOf` /
  `regionNamesOf` moved to `components/source/source-labels.ts` (second consumer). Commits
  `e691da0`, `7233d7e`, `2ba7b4a`.
- 2026-10-08, B5: `POSITION_LABELS` moved to `apps/web/lib/position-labels.ts` (`2912bc0`; the
  legacy kept its enum labels in a shared `lib/enums/values.ts`). The detail shows 役職 (the legacy
  form asked for it, its detail left it out), the whole address (master part and typed line; the
  legacy showed the typed line) and every current 担当者. 在籍情報's 担当者 are those in charge at
  some point of the period (`chargersDuring`); the legacy counted the assignments made inside it,
  having no end date. `ageOf` comes from `@repo/validation`, so there is no `staff-age.ts`.
  `DescriptionList` items take a `key` (memos share the label メモ, `f6d5e24`).
  The 担当スタッフ card lives in the staff feature (`UserStaffsCard`, `UserStaffsContainer`) and the
  user detail page hands it to `UserDetailContainer`'s `staffs` slot, instead of
  `features/users/components/detail/user-staffs-card.tsx`: features do not import each other (ui.md;
  bulletproof-react's discussion route composes the comments feature). Its rows open the staff
  detail page, not a dialog. Commits `2912bc0`, `cdaf662`, `f6d5e24`, `e9da9af`, `0b0ca69`.
- 2026-10-08, phase B status: implemented and green on every Docker-free check. The testcontainers
  suites, the drift gate, the dev-database deploy and the browser check (four roles on
  `/admin/staff`, a staff detail, a user detail) wait on the Docker Desktop API, as for phase A.
  Phase C starts meanwhile.
- 2026-10-08, C1–C4: as planned, with these differences. C1's `useStepper.goTo` goes back only (the
  legacy `Steps` let completed steps be clicked; forward is `goNext`), and `goNext` focuses the
  first error. C2 is `AddressFields` alone: the 定型文 shortcuts are a row of buttons inside
  `staff-memo-fields.tsx` (one consumer, no app-level component yet); the lookup runs as the post
  code is typed (`TextField` gained `onValueChange`), so the legacy 検索 button is dropped; an
  unknown code shows the legacy toast 郵便番号が見つかりません。 and leaves 住所(県名) empty, which
  the form schema refuses (`addressFormSchema`, `staffFormSchema` in `@repo/validation`). Two small
  promotions came with their second consumer: `NameFields` (`apps/web/components/name-fields.tsx`,
  was the users feature's `UserNameFields`) and `ArrayField`'s `hideLabel` (the card title names the
  rows). C3/C4: one `StaffForm` for create and edit, configured by props; its steps are
  `StaffBasicStep`, `StaffFamilyMemberFields` + `StaffMemoFields` and `StaffFormConfirm` (repeated
  rows numbered, not separated). The 担当者 on offer are looked up inside the form (`findChargers`,
  React Query keyed by the chosen regions), because they depend on the form's own values; an edited
  staff's stored 担当者 stay on offer so opening and saving never drops one. 年齢 is 生年月日's
  description. The edit returns to the staff detail, where the legacy toast points (the legacy
  opened the list); its キャンセル goes there too. Commits `5c403e1`, `1bc49cd`, `c8456d4`,
  `2436818`, `fd5ba8e`, `478bd34`, `c64bf57`.
- 2026-10-08, phase C status: implemented and green on every Docker-free check. Pending with phases
  A and B: the testcontainers suites, the drift gate, the dev-database deploy, the browser check
  (staff create and edit next to the legacy form), the verifier, and the move of this plan to
  `docs/plans/2026-10-08-staff.md` at Close.
- 2026-10-08, review round 1 (reviewer agent on the whole branch: 0 BLOCKER, 5 SHOULD, 6 NIT; all
  SHOULD fixed, NITs fixed or recorded here):
  - `staff.update` checks only the 担当者 being added, so a staff whose 担当者 was deactivated since
    stays editable (`assertChargersActive`); `removeMany` and `listByCharger` compose
    `accessibleStaffWhere` like `list` (repository `where` parameters), so a later row rule applies
    everywhere.
  - `useStepper.goNext` ignores a call while one runs and moves from the step it was asked on; the
    staff form ignores a submit that is part of a double click, so its second click can neither
    skip 家族情報・メモ nor send the form from 確認 unseen.
  - The status and delete dialogs keep no component test, as the users dialogs: they own their tRPC
    mutation, and the pieces they rely on are tested (`ConfirmDialog` with a body and
    `confirmDisabled`, the labels); `StaffFamilyTable` gained one.
  - Recorded differences: the service checks the regions, prefectures and post code before writing
    (one `ValidationError` naming the unknown codes) instead of translating a foreign-key violation;
    `listStaffsSchema.statuses` is optional and the service applies the legacy default (every status
    but 停止); the 定型文 load with the form page, not when step 2 opens (the container owns the
    query, the form stays presentational); `staff_chargers` keeps `created_at` as the assignment
    time instead of an `assigned_at` column, and the lists carry `sort_order` (ADR 0008);
    `staff.deleteMany` takes up to 50 ids where the legacy refused 50 and more, as
    `COMMENT_TEMPLATES_DELETE_MAX`.
  - `user.chargerOptions` is not forbidden to an AM, as A4 expected: the self rule passes
    `requireAbility("read", "User")` and `accessibleUsersWhere` leaves the AM only their own row
    (now pinned by a router test). Today only the admin roles create or edit staff and they read
    every user; a role that edits staff without reading users would need the charger lookup widened
    — open point for that role's ticket.
  - The two copies of the 社員番号 / スタッフ番号 search parser are one: `employeeNumberOfSearch` in
    `@repo/validation`.

# ADR 0008 — スタッフ (staff) as their own aggregate

Date: 2026-10-08 · Status: accepted

## Context

The legacy API kept スタッフ and the 担当者 profiles in one MySQL table `Staff`
(`employeeType: USER` for the latter), linked to a user by an optional email. A スタッフ has
a 雇用区分, a スタッフ番号, names and readings, 性別, 生年月日, 役職, 支店名, contact
data, エリア / 地域 / 都道府県, an address (post code into the Japan Post master plus a typed
line), 担当者 (users, kept as name snapshots because users could be deleted), family members, memos
(five fixed types plus custom ones) and employment periods. Its status mixed a state (`DELETE`
= 停止) with a deletion marker (`DELETED`, the number scrambled so it could be reused). スタッフ do
not sign in today. The 担当者 profiles moved to `user_profiles` (ADR 0007).

## Decision

- **`staffs`** (`Staff` in the schema folder `staff/`, migration `add_staffs`): `employee_type`
  (`enum EmployeeType`, the legacy set without `USER`), `employee_number`, the four name columns
  (required, as the legacy form), `gender` (`enum Gender`), `birthday` `DATE`, `position`
  (`enum Position`, ADR 0007), `branch_name`, `email`, `phone_number`, `emergency_phone_number`,
  `areas source_area[]`, `status` (`enum StaffStatus ACTIVE | INACTIVE | SUSPENDED`
  = 利用中 / 保留 / 停止) and `deleted_at`. Columns the legacy allowed empty stay nullable; the form
  requires what the legacy form required.
- **スタッフ削除** is a soft delete allowed only for a 停止 staff (the legacy rule); the list never
  shows deleted rows. **スタッフ番号** is unique among non-deleted staff: a service rule checked in
  the write's transaction (a partial unique index Prisma cannot express), so a deleted staff frees
  its number without scrambling it.
- **`staff_regions`, `staff_prefectures`**: join tables on the reference data's natural `code`
  (composite keys, `Restrict` to the reference row, `Cascade` to the staff).
- **`staff_addresses`** (1:1): `post_code` → `source_addresses.post_code` (`Restrict`) and the typed
  `address1` (番地・建物名); 都道府県 / 市区町村 / 町域 are read from the master, not stored twice.
- **`staff_chargers`**: one row per 担当者 assignment, `user_id` → `users.id` (`Restrict`: users are
  soft-deleted only), `created_at` = assigned, `unassigned_at` closes it. A change closes the
  removed 担当者 and adds the new ones, so 在籍情報 can name who was in charge during an employment
  period. No name snapshots.
- **`staff_family_members`, `staff_memos`, `staff_job_histories`** with a `sort_order`: the form
  sends each list whole and the service replaces it in the staff's transaction. Memos have the five
  fixed types (スタッフメモ, 入退社情報, 住所変更, 保険関係, その他) and `CUSTOM`; only memos with
  text are stored.

## Alternatives

スタッフ as users with a `staff` role (Better Auth's `users` needs a unique email, which
a スタッフ may not have; the admin plugin's bans, sessions and counts would apply to people who
never sign in; the catalog's `Admin_User` and `Admin_Staff` rows would become role conditions on one
subject); the legacy status with a scrambled number; snapshot columns for 担当者; per-row diffs of
the child lists (nothing references a child row, so replacing them is simpler and as correct).

## Consequences

When スタッフ must sign in, `staffs.user_id` (nullable, unique) links a user created with a new
`staff` role — the key A0 freed — and an email required at that moment; nothing here changes.
Concurrent edits of one staff overwrite each other (last write wins, as in the legacy). Porting the
legacy rows maps `Staff` (non-USER) with its children, `StaffAreas` into the array and
`StaffCharger` snapshots onto users by email.

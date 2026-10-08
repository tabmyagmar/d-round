# ADR 0007 — User profiles (担当者 HR fields) beside Better Auth's users

Date: 2026-10-08 · Status: accepted

## Context

The legacy API kept a 担当者's HR fields on a `Staff` row with `employeeType: USER`, linked to the
user by
email: 社員番号 (`employeeNumber`), 部署名, 役職 (`EnumPosition`), 退職日, エリア (`StaffAreas`)
and 地域 (`SourceRegionOnStaffs`). Every user query joined `Staff`, and every staff query filtered
the user rows out. The user list shows 社員番号 / エリア / 地域, filters by エリア / 地域 / 役職,
and the スタッフ form offers as 担当者 the users whose 地域 overlap the staff's. The name parts
(姓 / 名 / セイ / メイ) already live on `users` (ADR 0002, 2026-10-07).

## Decision

- **`user_profiles`** (`UserProfile` in the schema folder `profile/`, migration
  `add_user_profiles`): one row per user (`user_id` unique, `onDelete: Cascade`) with
  `employee_number Int` (unique), `department_name VARCHAR(80)`, `position position`,
  `retirement_date DATE` (nullable) and `areas source_area[]`. `enum Position` (legacy
  `EnumPosition`, 13 values) is shared with the スタッフ aggregate to come.
- **`user_profile_regions`** (`UserProfileRegion`): the 地域 of a 担当者, composite primary key
  `(user_id, region_code)`, `region_code` → `source_regions.code` (`Restrict`, ADR 0005), indexed
  for the charger lookup. Users get エリア and 地域 only, no 都道府県, as the legacy user form and
  filters had.
- **The name parts stay on `users`.** Better Auth's `name` ("姓 名") is built from them and the
  session, the mails and every user label read it without a join; the profile holds what Better Auth
  never reads. `auth/user.prisma` gains only the relation field `profile UserProfile?`.
- **社員番号 is unique in the database**: users are soft-deleted only, so a number is never freed;
  the service maps the violation to a conflict.
- The profile is required when a user is invited or edited (every field was required in the legacy
  form; 退職日 optional). Existing users have none until an edit adds it. Profile fields change only
  with the catalog's `update User` (rows 1101 / 1103), never through the self row rule, so a user
  cannot change their own 社員番号 or 役職.

## Alternatives

A `Staff` row per user as in the legacy (a join for every user query, a filter for every staff
query, an optional email link); the four name columns moved into the profile (a second migration of
data added the day before, and a join for every display name); 地域 as an `Int[]` of codes (no
foreign key, every reader needs a code → name map); Better Auth `additionalFields` on `users` (the
admin plugin and its CLI would own columns it never reads).

## Consequences

User reads include the profile (one left join plus the regions). A later スタッフ login links a
`staffs` row to a user (`staffs.user_id`), not a profile. Porting legacy USER rows is a mapping of
`Staff{employeeType: USER}` into `user_profiles` (+ regions) by email; 都道府県 on users would be
one more join table.

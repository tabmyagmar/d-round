# Plan: User feature — list, detail, create, update on tRPC

Ticket: `feature/D_ROUND-TBD_user-feature` (one MR, ten commits, each green on its own, ≤15 files
each). Status: **approved 2026-10-07** with every default below. Legacy references studied:
`d-round-web/src/features/user/**` (product behaviour: `UserColumns`, `UsersToolbar`,
`UserDetailContainer`, `UserForm*`, `PermissionSetting`/`PermissionList`, `schema/roleOptions`) and
`romuten-v3/apps/web/src/{features/user,hooks}` (structure: `useSearch`, `useTable`,
`store/provider.tsx`, `UserFilter` with `next/dynamic`).

## Goal and acceptance criteria

Replace the three user screens (`users-table.tsx`, `user-editor.tsx`, the `create` / `update/[id]`
placeholders) with the legacy 担当者管理 feature on this repo's stack, and leave behind the folder
structure, URL-state hooks and table conventions the client / branch / staff lists will reuse.

- `/admin/master/user`: toolbar (検索, アカウントタイプ, ステータス, 担当者追加) and a table with
  the legacy columns that exist on `User` today
  — 氏名, メールアドレス, アカウントタイプ, ステータス, row actions (詳細 / 編集 / 無効化・有効化) —
  sortable by 氏名 and メールアドレス, paged. Search, filters, page and sort live in the URL
  (`?search=&role=&status=&page=&sortBy=&sortOrder=`), so a link reproduces the view and
  back/forward works.
- `/admin/master/user/[id]`: read-only detail (基本情報, 権限 for a
  manager, 担当クライアント / 担当スタッフ placeholders) with a
  toolbar: 編集, パスワード設定メール, 無効化 / 有効化. Each action is shown by ability (`update` /
  `status` on that row) and enforced by the API.
- `/admin/master/user/create`: invite form (メールアドレス + 確認, 氏名, アカウントタイプ,
  and権限（詳細設定） when the chosen role is manager). `/admin/master/user/update/[id]`: the same
  fields minus the email, saving name, role and permission overrides in **one** mutation.
- Roles an actor may assign are decided once (`assignableRoles` in `@repo/validation`), enforced by
  the API and merely rendered by the web. Manager permission overrides are `user_permissions` rows
  (ALLOW adds, DENY removes — ADR 0003), written through the API, never replaced wholesale.
- Every `/admin` page stays `<PageGuard route={routes.x.y}>` at its root (`route-tree.test.ts`),
  every link is `href(routes.…)`, every new procedure has `requireAbility`, services throw domain
  errors, and the data layer is testcontainers-tested. `yarn verify` green per commit.
- UI text in Japanese, as in the legacy app and the shell.

## Decisions (all defaults confirmed by the user, 2026-10-07)

1. **Data fetching stays client-side** (`useQuery(trpc.user.list.queryOptions(input))`, with
   `placeholderData: keepPreviousData` so paging does not flash). Both legacy apps fetch in an async
   server container; here `.claude/rules/layers.md` lets the web import `@repo/api` **types** only
   and the `nextjs` skill says server components never call tRPC. URL params still drive the input
   (`useSearchParams` in the client container). `app/admin/loading.tsx` + `DataTable isLoading` are
   the only loading states; no `Suspense` / `ViewTransition` port.
2. **Legacy columns that need data we do not have yet are deferred**: 社員番号, エリア, 地域 come
   from the legacy `Staff{employeeType: USER}` profile row, which this repo does not model (the
   user-profile ticket will add `user_profiles`, see the Staff / User discussion of 2026-10-07). The
   column order keeps their slots (社員番号 before 氏名, エリア・地域 after メールアドレス) so that
   ticket only inserts columns. Alternative: port them as empty columns now — rejected, empty
   columns look broken.
3. **Status is a badge + a confirmed row action, not an inline `Select`.** The legacy row changed
   status from a select without confirmation. Here 無効化 / 有効化 go through `ConfirmDialog`
   (ui.md: every confirmation) from the row's actions menu and the detail toolbar. This needs the
   missing counterpart of `deactivate`: `user.reactivate` (catalog action `status`, row 1105), and a
   `status` filter (`active` default, `deactivated`) because `findMany` hides soft-deleted rows.
4. **No select column and no zustand store in this ticket.** The legacy checkbox column fed bulk
   delete and CSV download with selected ids; neither exists here (no `delete` procedure, CSV/print
   out of scope). A store with no consumer is dead code. The slot is `features/users/store/` with
   the romuten-v3 `useRef` provider pattern; it arrives with the first bulk action, and `zustand` is
   added then (`npm view zustand version` + reason in that commit). Alternative: add the column and
   the store now — rejected (CLAUDE.md: no dependency without a use).
5. **Filters are inline controls, not a popover.** The list has three inputs (search, role, status);
   romuten-v3's `FilterPopover` + tags + `next/dynamic` pays off at five or more (staff / client
   lists). The toolbar layout and the URL-state hooks are what those lists reuse.
6. **Create has no 入力 → 確認 step.** The legacy two-step form carried a dozen staff fields; this
   one has four. Keep the typo guard that matters for an invitation
   mail: メールアドレス確認 (`inviteUserFormSchema`, web-side refinement in `@repo/validation`, the
   API keeps `inviteUserSchema`).
7. **`user.changeRole` is folded into `user.update`** (`userId, name?, role?, permissionKeys?`), one
   transaction with every rule (row `update` ability; `changeRole` ability + `assignableRoles`
   - last-admin for a role change; `changeRole` ability for overrides). The detail page becomes
     read-only (legacy `UserDetailContainer`), editing happens on `update/[id]`; the role card in
     `user-editor.tsx` goes. Catalog action `changeRole` (row 1106) stays the gate.
8. **Permission overrides apply to managers only** (legacy: the dialog shows for MANAGER). The API
   accepts `permissionKeys` only when the resulting role is in `OVERRIDABLE_ROLES = ["manager"]`
   (`@repo/validation`, next to `assignableRoles`) and deletes a user's overrides when their role
   leaves that set. The client sends the **selected child keys**; the service derives the rows
   against the role's grants (checked ∖ role → ALLOW, role ∖ checked → DENY) so the ADR 0003 storage
   semantics stay in one place.
9. **`permission.catalog`** (new `permission` module, module-template file set) returns the visible
   catalog as parents with children and, per child, the roles that hold it. Gated by
   `requireAbility("changeRole", "User")`: only someone who may change roles sees the matrix.
   `user.byId` gains `permissionKeys` (effective child keys, from `findEffectiveGrants`) so the
   update form and the detail summary need no third call.
10. **Mutation hooks only where two callers exist**: `use-user-status.ts` (deactivate / reactivate:
    list row + detail toolbar) and `use-send-password-reset.ts` (detail toolbar now, list later).
    Invite and update are inlined in their forms (`useMutation` + toast, as `profile-form.tsx`).
11. **Shared hooks live in `apps/web/hooks/`** (new, added to the ui.md table): `use-search.ts`,
    `use-table-state.ts`, `use-debounced-value.ts`, over a pure, node-tested
    `hooks/search-params.ts`. No `nuqs`: the three hooks are ~120 lines and the pure core is
    testable without a router.

## Design

### Feature layout — `apps/web/features/users/`

```text
features/users/
  role-badge.tsx                 (unchanged; imported by components/layout/user-menu.tsx)
  user-status-badge.tsx          有効 / 無効 from `deletedAt` (StatusBadge success / neutral)
  list/
    users-page.tsx               client container: URL → ListUsersInput → useQuery → toolbar + table
    users-toolbar.tsx            検索 (debounced), アカウントタイプ, ステータス, 担当者追加 (Can create)
    users-table.tsx              columns (legacy order) + DataTable (sorting, pagination from URL)
    user-row-actions.tsx         DropdownMenu: 詳細 / 編集 / 無効化・有効化 (by ability on the row)
    build-user-list-input.ts     pure: URLSearchParams → ListUsersInput
  detail/
    user-detail.tsx              container: byId → header (h2 name, email, badges) + cards
    user-detail-toolbar.tsx      編集 (Link), パスワード設定メール, 無効化 / 有効化 (ConfirmDialog)
    user-permission-summary.tsx  manager: effective permissions grouped by parent (catalog + keys)
    user-charges-placeholder.tsx 担当クライアント / 担当スタッフ as EmptyState + TODO comment
  form/
    user-form-fields.tsx         shared fields: 氏名, メールアドレス(+確認 | read-only), アカウントタイプ, 権限
    user-create-form.tsx         invite: inviteUserFormSchema → trpc.user.invite → detail page
    user-update-form.tsx         updateUserSchema → trpc.user.update → detail page
  permission/
    permission-dialog.tsx        Dialog trigger 権限（詳細設定）; content via next/dynamic (ssr: false)
    permission-list.tsx          CheckboxGroupField per parent (children), bound to `permissionKeys`
    use-permission-catalog.ts    useQuery(trpc.permission.catalog.queryOptions())
  hooks/
    use-user-status.ts           deactivate / reactivate mutations + toast + invalidate
    use-send-password-reset.ts
  profile/
    profile-form.tsx, profile-editor.tsx, password-change-form.tsx   (moved, unchanged)
```

Route files stay thin: `page.tsx` renders one feature component inside `PageGuard`. `create` and
`update/[id]` are server pages that read `getCurrentUser()` (cached per request, the guard already
fetched it) and pass `callerRole` to the form, which renders `assignableRoles(callerRole)`.

### Validation — `packages/validation/src/user.schema.ts`

```ts
export const USER_SORT_FIELDS = ["name", "email", "createdAt"] as const;
export const USER_STATUSES = ["active", "deactivated"] as const;
export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  status: z.enum(USER_STATUSES).default("active"),
  sortBy: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/** Roles `callerRole` may give another user; the API enforces it, the web renders it. */
export const assignableRoles = (callerRole: Role): readonly Role[] => …; // admins: ROLES; manager: ["manager","staff"]; staff: []
export const OVERRIDABLE_ROLES = ["manager"] as const satisfies readonly Role[];

export const inviteUserSchema = z.object({ email, name, role, permissionKeys: z.array(z.string()).optional() });
export const inviteUserFormSchema = inviteUserSchema.extend({ emailConfirm: emailSchema })
  .refine((v) => v.email === v.emailConfirm, { path: ["emailConfirm"], error: "メールアドレスが一致していません" });
export const updateUserSchema = z.object({ userId: idSchema, name: nameSchema.optional(), role: roleSchema.optional(), permissionKeys: z.array(z.string()).optional() });
// changeRoleSchema is removed (folded into updateUserSchema).
```

### Repositories

- `user.repository.ts`:
  `findMany(params, where, { orderBy?: { field: UserSortField; direction }, deleted?: "exclude" | "only" })`
  (default unchanged: `deleted: "exclude"`, `createdAt desc`); `restore(id)` sets `deletedAt: null`.
- `permission.repository.ts`: `findCatalog()` — `visible: true` rows ordered by `key` with
  `roles: { select: { roleKey } }`; `findUserOverrides(userId)` — `{ permissionKey, effect }[]`;
  `replaceUserOverrides(userId, rows: { permissionKey; effect }[], assignedBy)` — `deleteMany` +
  `createMany` on the transaction client the service passes. Repositories stay rule-free: deriving
  ALLOW/DENY and the manager-only rule happen in the service.

### Services

- `user.service.ts`: `list` adds `status` and `orderBy`; `reactivate(ctx, userId)` (`status`
  ability, `assertCan`, not found when active, `restore`); `invite` checks `assignableRoles` and,
  when `permissionKeys` is present, applies the overrides after `createUser` (two calls — see
  Risks); `update(ctx, input)` replaces `changeRole`: load, `assertCan("update")`; if `role` differs
  → `changeRole` ability, assignable, last-admin, `updateRole`; if `permissionKeys` → `changeRole`
  ability, keys ⊂ catalog children (else `ValidationError`), role ∈ `OVERRIDABLE_ROLES` (else
  `ConflictError`), derive rows against the role's grants, `replaceUserOverrides`; if the role
  leaves `OVERRIDABLE_ROLES` → overrides deleted. All in one `withTransaction`. `getById` returns
  `UserDetail = User & { permissionKeys: string[] }`.
- `permission.service.ts` (new): `catalog(ctx)` → `PermissionCatalogGroup[]`
  `{ key, nameJp, children: { key, nameJp, action, modelName, roles: string[] }[] }`.

### Routers

- `user.router.ts`: `reactivate` (`status`), `update` (`update`; the service adds `changeRole` where
  needed) replaces `changeRole`; `byId` unchanged signature, richer output.
- `permission.router.ts` (new): `catalog` (`changeRole User`), registered in `router.ts`.

### `packages/ui` — `DataTable`

- `dataTableFeatures = tableFeatures({ rowSortingFeature })`, `manualSorting`, new optional prop
  `sorting?: { state: SortingState; onChange: OnChangeFn<SortingState> }`; a header helper
  `sortableHeader(label)` renders the toggle button (`ArrowUpDown`) for columns with
  `enableSorting: true`. Verify the v9 names with Context7 before writing (9.2.4 is pinned).
- `DataTablePagination.labels?: { previous; next; summary: (p) => string }` so the web can render
  `全 12 件 · 1 / 2 ページ`; English defaults unchanged.

### Web hooks — `apps/web/hooks/`

- `search-params.ts` (pure): `withParam(params, name, value | null)`, `withParams(params, record)`,
  `NON_RESET_KEYS = ["page", "perPage", "sortBy", "sortOrder"]` — any other key resets `page`.
- `use-search.ts`: `{ params, get, set, setMany, clear }` over `useSearchParams` / `useRouter`
  (`router.push(…, { scroll: false })`).
- `use-table-state.ts`: reads `page / perPage / sortBy / sortOrder`, returns
  `{ pagination(pageResult, labels), sorting }` ready for `DataTable`.
- `use-debounced-value.ts`: 300 ms for the search box.

## Steps (commits)

Order: 1 → {2 → 3} ‖ 4 ‖ 5 ‖ 6 → 7 → 8 → 9 → 10. `[parallel: A]` = 4, 5, 6 may run beside 2–3
(disjoint files; 5 needs 1).

### 1. `feat(api): user list sorting and status filter, user.reactivate`

Files (8): `packages/validation/src/user.schema.ts`, `packages/validation/test/user.schema.test.ts`,
`packages/database/src/repositories/user.repository.ts`,
`packages/database/test/repositories/user.repository.test.ts`,
`apps/api/src/modules/user/user.service.ts`, `apps/api/src/trpc/routers/user.router.ts`,
`apps/api/test/modules/user/user.service.test.ts`, `apps/api/test/trpc/routers/user.router.test.ts`.
Tests first: schema defaults and rejects (`sortBy: "role"`, `status: "x"`); repository `findMany`
orders by `name asc` / `email desc`, `deleted: "only"` returns soft-deleted rows only, `restore`
clears `deletedAt`; service `list` with `status: "deactivated"` lists a deactivated user and
`active` does not, `reactivate` → `NotFoundError` for an active user, `ForbiddenError` without
`status`, restores and is listable again; router `reactivate` maps the errors.

### 2. `feat(api): assignable roles and the permission catalog`

Files (9): `packages/validation/src/user.schema.ts` (`assignableRoles`, `OVERRIDABLE_ROLES`),
`packages/validation/test/user.schema.test.ts`,
`packages/database/src/repositories/permission.repository.ts`,
`packages/database/test/repositories/permission.repository.test.ts`,
`apps/api/src/modules/permission/permission.service.ts`,
`apps/api/src/trpc/routers/permission.router.ts`, `apps/api/src/trpc/router.ts`,
`apps/api/test/modules/permission/permission.service.test.ts`,
`apps/api/test/trpc/routers/permission.router.test.ts`. Tests: `assignableRoles` table (admins → all
four, manager → manager + staff, staff → none); `findCatalog` returns parents with role keys per
child and hides `visible = false` rows (inside the rolled-back transaction, as the existing
repository test does); `replaceUserOverrides` replaces, never appends; `catalog` throws
`ForbiddenError` for a user without `changeRole`, groups children under their parent in key order.

### 3. `feat(api): user.update with role and permission overrides; invite with overrides`

Files (9): `packages/validation/src/user.schema.ts` (`updateUserSchema`, `inviteUserSchema` +
`permissionKeys`, `inviteUserFormSchema`, drop `changeRoleSchema`),
`packages/validation/test/user.schema.test.ts`, `apps/api/src/modules/user/user.service.ts`,
`apps/api/src/trpc/routers/user.router.ts`, `apps/api/test/modules/user/user.service.test.ts`,
`apps/api/test/trpc/routers/user.router.test.ts`, `apps/web/features/users/user-editor.tsx` (its
role card calls `update({ userId, role })` so the web stays green until step 8 deletes the file),
`docs/adr/0003-permissions.md` (`## Changes` line: assignable roles, overrides API, manager-only),
`.claude/rules/permissions.md` (the two rules, one paragraph each). Tests: `update` name only (no
`changeRole` needed); role change by a manager to `admin` → `ForbiddenError`; last-admin demotion →
`ConflictError` (reuse `parkOtherAdmins`); `permissionKeys` on a staff target → `ConflictError`;
unknown key → `ValidationError`; manager with one extra and one removed key → exactly one ALLOW and
one DENY row and `permission-catalog`-style `ctx.ability` reflects both; manager → staff deletes the
rows; `invite` by a manager with `role: "admin"` → `ForbiddenError`; invite with keys writes the
rows; `byId.permissionKeys` equals the effective grants.

### 4. `feat(ui): DataTable sorting and pagination labels` `[parallel: A]`

Files (3): `packages/ui/src/components/composed/data-table.tsx`,
`packages/ui/test/components/composed/data-table.test.tsx` (jsdom; add the vitest setup as in
`apps/web` if `packages/ui` has none yet — check first), `.claude/rules/ui.md` (DataTable props
line). Tests: clicking a sortable header calls `onChange` with `[{ id, desc }]`; non-sortable
headers render no button; `labels.summary` is rendered when given.

### 5. `feat(web): URL search-param hooks and the user list input builder` `[parallel: A]`

Files (8): `apps/web/hooks/search-params.ts`, `apps/web/hooks/use-search.ts`,
`apps/web/hooks/use-table-state.ts`, `apps/web/hooks/use-debounced-value.ts`,
`apps/web/test/hooks/search-params.test.ts`, `apps/web/test/hooks/use-debounced-value.test.tsx`,
`apps/web/features/users/list/build-user-list-input.ts`,
`apps/web/test/features/users/list/build-user-list-input.test.ts`. Tests (node): `withParam` deletes
on `null` / `""`, resets `page` for a filter key and keeps it for `sortBy`; `withParams` applies a
record; `buildUserListInput` maps a full query string, ignores unknown values (`role=root` → no
role), defaults page to 1.

### 6. `refactor(web): move profile components under features/users/profile` `[parallel: A]`

Files (6): `apps/web/features/users/profile/{profile-form,profile-editor,password-change-form}.tsx`
(moves), `apps/web/app/admin/profile/page.tsx`, `apps/web/features/users/user-editor.tsx` (import),
`apps/web/test/features/users/profile/password-change-form.test.tsx` (move). No behaviour change.

### 7. `feat(web): users list — legacy columns, URL state, row actions`

Files (10): `apps/web/features/users/list/users-page.tsx`, `…/list/users-toolbar.tsx`,
`…/list/users-table.tsx` (replaces `features/users/users-table.tsx`), `…/list/user-row-actions.tsx`,
`apps/web/features/users/user-status-badge.tsx`, `apps/web/features/users/hooks/use-user-status.ts`,
`apps/web/app/admin/master/user/page.tsx`, `apps/web/test/features/users/list/users-table.test.tsx`,
`apps/web/test/features/users/list/user-row-actions.test.tsx`,
`apps/web/test/features/users/user-status-badge.test.tsx`. Tests (jsdom, `abilityWith` from
`test/support/grants.ts`): the table renders the four headers in legacy order and a 無効 badge for a
deactivated row; row actions show 編集 only with `update`, 無効化 only with `status`, 有効化 for a
deactivated row; the toolbar hides 担当者追加 without `create`.

### 8. `feat(web): user detail — read-only view, toolbar, placeholders`

Files (9): `apps/web/features/users/detail/user-detail.tsx`, `…/detail/user-detail-toolbar.tsx`,
`…/detail/user-permission-summary.tsx`, `…/detail/user-charges-placeholder.tsx`,
`apps/web/features/users/permission/use-permission-catalog.ts`,
`apps/web/features/users/hooks/use-send-password-reset.ts`,
`apps/web/app/admin/master/user/[id]/page.tsx`, delete `apps/web/features/users/user-editor.tsx`,
`apps/web/test/features/users/detail/user-detail-toolbar.test.tsx`. The placeholder cards carry
`// TODO(D_ROUND-TBD): 担当クライアント / 担当スタッフ once the Client and Staff models exist (legacy UserClients / UserStaffs).`
Tests: toolbar actions by ability as in step 7; the summary lists only the parents that have at
least one effective child.

### 9. `feat(web): user create (invite) and update forms with the permission dialog`

Files (12): `apps/web/features/users/form/user-form-fields.tsx`, `…/form/user-create-form.tsx`,
`…/form/user-update-form.tsx`, `apps/web/features/users/permission/permission-dialog.tsx`,
`…/permission/permission-list.tsx`, `apps/web/app/admin/master/user/create/page.tsx`,
`apps/web/app/admin/master/user/update/[id]/page.tsx`,
`apps/web/test/features/users/form/user-create-form.test.tsx`,
`apps/web/test/features/users/form/user-update-form.test.tsx`,
`apps/web/test/features/users/permission/permission-list.test.tsx`,
`apps/web/test/app/route-tree.test.ts` (only if the `callerRole` prop trips the guard regex —
expected not to), `.claude/rules/ui.md` (Forms example paths). Tests: create form labels;
mismatched 確認 shows the message; role options follow `callerRole` (manager sees
two); 権限（詳細設定）appears only when the selected role is overridable; update form shows the
email read-only; the permission list pre-checks the role's keys from the catalog fixture and reports
the selected keys.

### 10. `docs: users feature structure, hooks, DataTable sorting, assignable roles`

Files (≤6): `.claude/rules/ui.md` (Where components live: `features/users/<area>/`,
`apps/web/hooks/`; promotion rule example paths), `.claude/skills/nextjs/SKILL.md` (list / form
example paths, URL-state pattern), `.claude/rules/module-template.md` (pointer paths),
`.claude/rules/permissions.md` (Web table example paths), `docs/auth.md` (invite with overrides, one
sentence), `plan.md` → `docs/plans/2026-10-07-user-feature.md` at Close (Outcome section).

## Amendments

- 2026-10-07, step 2: `assignableRoles` follows the legacy picker exactly (`USER_ROLES` = admin,
  manager, staff): `super_admin` and `admin` assign admin / manager / staff, a manager manager /
  staff, staff nothing — `super_admin` is never assigned through the app. Today an admin can promote
  to `super_admin` through `user.changeRole`; step 3 removes that, and the changeRole test "lets the
  last admin-role user move to the other admin role" moves to the super_admin → admin direction. The
  permission module's `permission.schema.ts` (module template) holds `permissionKeysSchema`, used
  from step 3.

- 2026-10-07, order: the Docker daemon's API stopped answering during step 2's verify (the
  containers kept serving their ports; restarting Docker Desktop would stop the user's other
  project's containers, so it is left to the user). Steps 4, 5, 6 and 7 (Docker-free,
  `[parallel: A]` or web-only on step 1's API) were committed first, each verified with
  `yarn verify` while the uncommitted step 2 was stashed, so every Docker-backed test task was a
  cache hit of step 1's green run (no inputs changed). Steps 2 and 3 are verified when Docker
  answers again.
- 2026-10-07, step 4: no `sortableHeader` helper — `DataTable` renders the toggle button itself for
  a column with `enableSorting: true` (`defaultColumn: { enableSorting: false }`), with `aria-sort`.
- 2026-10-07, step 5: `use-debounced-value.ts` became `use-debounced-callback.ts` (debounce the
  change event; a debounced value mirrored into an effect that navigates is the effect-for-events
  anti-pattern). `features/users/list/build-user-list-input.ts` became the shared
  `parseSearchParams(schema, params)` in `hooks/search-params.ts`, which reads each parameter
  through the list's own zod input schema — every list reuses it. `pageToParam` keeps page 1 out of
  the URL.
- 2026-10-07, step 7: split into 7a (shared: `components/search-input.tsx`, `UserStatusBadge`,
  `UserStatusDialog`, Japanese `ROLE_LABELS`) and 7b (the list), to stay under 15 files. The plan
  said `ROLE_LABELS` were already Japanese; they were English and now carry the legacy labels
  (スーパーアドミン, アドミン, マネジャー, AM); statuses are 利用中 / 停止 as in the legacy app. The
  deactivate / reactivate mutations live in `UserStatusDialog` (its only caller), so there is no
  `hooks/use-user-status.ts`; the list keeps the chosen row in `useState` and renders one dialog. A
  deactivated user's row offers only 利用再開 and no detail link: `user.byId` does not find
  deactivated users. The toolbar is presentational (`filters`, `onChange`) so it is tested without a
  router. Base UI's `Button` rendering a `Link` keeps `role="button"` on the `<a>`.

- 2026-10-07, step 3: besides the new role, `update` checks that the caller may assign the user's
  **current** role (a manager holding `changeRole` must not demote an admin). With `super_admin`
  never assignable, a super_admin's role cannot change in the app at all, so the step 2 note is
  superseded: the changeRole test "lets the last admin-role user move to the other admin role"
  becomes "never assigns super_admin and leaves a super_admin's role alone". Override keys are
  checked against the visible catalog children; invite validates them before Better Auth creates the
  user. The docs that name `changeRole`, `user-editor` or the old paths (ui.md, skills, README,
  module-template) move to step 10 with permissions.md (it also needed new web examples); ADR 0003
  stays in step 3. Self-review added two escalation guards with tests: nobody edits their own
  overrides, and a caller may only ALLOW a permission their own session grants (otherwise a manager
  holding `changeRole` could hand out — or, through a second manager, receive — anything).
- 2026-10-07, step 8: the toolbar and the permission summary are presentational (props in, ability
  inside) so they are tested without tRPC; the detail container owns the queries and the dialogs
  (`PasswordMailDialog`, `UserStatusDialog`, whose `onDone` goes back to the list because
  `user.byId` does not find a deactivated user). `permission-catalog.ts` holds the pure catalog
  helpers (`roleKeysOf`, `grantedGroups`); the catalog is fetched only when the 権限 card shows
  (manager target, caller holds `changeRole`). `use-send-password-reset.ts` was not needed: the
  dialog is the mutation's only caller.
- 2026-10-07, step 9: two thin forms (invite, edit) over a shared `UserFormFields`
  (氏名, アカウントタイプ, 権限（詳細設定）) — each form keeps its own schema, mutation and email
  fields, which a `mode` prop would have branched on everywhere. `roleFieldState` (pure) decides the
  role options. The permission dialog's body (`permission-dialog-body.tsx`: catalog query +
  `PermissionEditor`) is loaded with `next/dynamic` when the dialog opens, so the form fields test
  without tRPC; the editor marks the role's permissions 標準 and offers 標準に戻す. The edit form
  sends only what changed; the email is shown, not edited. No shadcn addition (`accordion` not
  needed: fieldsets with checkboxes).

## Review round 1 (user, 2026-10-07): structure, reusable components, lazy loading

The user's review of steps 4–9 asked for: the feature folder split by technical role as in
romuten-v3 (not by screen), reusable composed components other features can take (select, filter,
toolbar, dialog, …), lazy loading so a page first loads only what it shows, the filter rendered only
when used, the permission dialog fixed and the CSV toolbar parts left out for now.

Research: bulletproof-react (`docs/project-structure.md`) splits a feature by role — `api`,
`components`, `hooks`, `stores`, `types`, `utils`, "only the ones that are necessary" — keeps shared
code in app-level `components`, `hooks`, `stores`, and composes features at the application level
instead of importing across them; Next.js documents feature/route colocation as unopinionated and
`next/dynamic` for client components loaded "only when/if the condition is met". romuten-v3 follows
the same split (`components`, `containers`, `graphql`, `hooks`, `schemas`, `store`, `utils`) with
`next/dynamic` filter contents and dialogs; d-round-web is a hybrid (screen folders under
`components/`). Splitting by screen (`list/`, `detail/`, `form/`) was a choice of steps 6–9, not a
convention; it is replaced.

Decisions:

1. **`features/users/`** = `containers/` (one entry per route; the only files pages import:
   `users-container`, `user-detail-container`, `user-create-container`, `user-update-container`,
   `profile-container`), `components/` (everything they render, dialogs with their mutation
   included), `hooks/` (`use-permission-catalog`), `utils/` (pure, node-tested), `types.ts` (the
   router output types). No `api/` or `graphql/` (tRPC hooks are called where used), no `schemas/`
   (zod lives in `@repo/validation`, shared with the API), no `stores/` until state is shared beyond
   one container (decision 4 stands). Forms are presentational (`onSubmit`, `pending`,
   `errorMessage`); their containers own the mutations, so forms test without tRPC.
2. **Reusable composed components** in `packages/ui/src/components/composed/` (domain-free, English
   defaults, Japanese passed by the app): `OptionSelect` (standalone select over `options`, optional
   "all" option, visible or hidden label) — also the base of `SelectField`; `SearchInput` (moved
   from `apps/web/components`) with `useDebouncedCallback` (moved to `packages/ui/src/hooks`);
   `FilterPopover` (trigger with the active-filter count, content rendered only while open, clear
   footer); `FilterTags` (active filters as removable chips + clear all); `ListToolbar` (search /
   filters / actions slots, bottom row); `RowActions` (row menu over an action list; hidden actions
   are filtered by the caller); `ContentDialog` (title, description, body, footer; body mounted only
   while open) with `ConfirmDialog` built on it; `DescriptionList` (label / value pairs for detail
   cards); `GroupedCheckboxList` (checkbox groups with a per-group select-all, `indeterminate`).
   Each has a jsdom test.
3. **Lazy loading** (`next/dynamic`, `ssr: false`, rendered only when used): the list's filter
   content (inside `FilterPopover`), the status dialog (list and detail), the password-mail dialog,
   the detail page's permission summary (managers only) and the permission dialog (from its form
   field). Row menus render their items only while open (Base UI). The pages stay server components
   rendering one client container.
4. **CSV** (legacy `CsvMenus`, `CsvDownloadDialog`) stays out; the toolbar carries a TODO where it
   goes.
5. App-level code stays where bulletproof-react puts it: `apps/web/hooks/` (URL state: `use-search`,
   `use-table-state`, `search-params`), `apps/web/components/` (shell, guard). The shell's user menu
   imports `RoleBadge` from the users feature (composition at the application level).

Outcome of the round: R1 `e3ff46d`, R2 `6a0289d`, R3 as three commits (`87ce908` list, `72e5033`
badges / labels, `339e069` profile; R3a shows 17 entries because the toolbar and row menu were
rewritten while moving), R4 `48a2c95`, R5 as two (`38e4e10` permission field / dialog / editor,
`55dcb12` forms), R6 this docs commit. Steps 2 and 3 were verified and committed first once Docker
answered again (`ed256dc`, `97d5e6d`); their new tests were watched failing against the old service
first.

Commits: R1 `feat(ui)` list building blocks (OptionSelect + SelectField on it, SearchInput +
useDebouncedCallback moved in, FilterPopover, FilterTags, ListToolbar, RowActions); R2 `feat(ui)`
ContentDialog (+ ConfirmDialog), DescriptionList, GroupedCheckboxList; R3 `refactor(web)` users list
and profile into `containers/` + `components/`, the list on the composed blocks, lazy filter and
status dialog; R4 `feat(web)` user detail (step 8 rebuilt); R5 `feat(web)` invite and edit forms
with the permission field and dialog (step 9 rebuilt); R6 `docs`. Each ≤15 files, `yarn verify`
green.

## Review round 2 (user, 2026-10-07): selection, pagination, table surface, names

The user asked for a select checkbox with the selection in a zustand store, the legacy pagination
(`<< <` pages `> >>` and a page box), a decision on the legacy card around the table, an explanation
of why the list is not fetched on the server, and 姓 / 名 / セイ / メイ with a zod rule for the
kana.

Decisions:

1. **Selection** is a DataTable feature (`rowSelection`, TanStack `rowSelectionFeature`, keyed by
   user id so it survives paging) and the users list keeps it in a per-screen zustand store
   (`features/users/stores/`), because two components share it: the table and the toolbar's new
   `SelectionBar` (count, 選択解除, slot for bulk actions — CSV export comes with its own ticket).
   zustand 5.0.15 is added to apps/web (decision 4 of the plan is superseded: the consumer exists).
2. **Pagination** is a composed `PaginationBar` (also usable outside tables) with first / previous /
   numbered pages with ellipsis / next / last and a page box, as the legacy
   `shared/components/table/pagination.tsx`.
3. **Card**: the legacy wrapped toolbar and table in a `Card` per page (`ContentWrapper`). The
   surface is right — the theme puts white cards on the blue-grey page — but it belongs to the
   shared table, not to each page: `DataTable` itself is the card (table + pagination on `bg-card`);
   the toolbar stays on the page background as in romuten-v3. No page wraps a list in another card.
4. **Server-side list** (explanation, no change): the list could be prefetched in the server page
   only over HTTP — `apps/web` may import `@repo/api` types only (`.claude/rules/layers.md`), so an
   in-process tRPC caller is not available; it would be a server tRPC client that forwards the
   cookie, `prefetchQuery` and a `HydrationBoundary`. That buys a first paint with rows instead of a
   skeleton, but every filter, page or sort change is a client query anyway (the URL drives a client
   container), each request makes an extra hop browser → Next → API, and the data is per-user, so
   nothing is cached. The legacy apps fetched in an async server component and called
   `router.refresh()` after each change. Kept client-side (decision 1); prefetch + hydration is the
   path if the first paint matters later.
5. **Names**: `users` gains `last_name`, `first_name`, `last_name_kana`, `first_name_kana`
   (nullable, expand only; ADR 0002); the forms require all four, readings in full-width katakana
   (`kanaSchema`, the legacy `KatakanaSchema` rule); the service keeps Better Auth's `name` as
   "姓 名"; search matches the readings; the seeded accounts have Japanese names. The migration was
   generated with `prisma migrate diff` (read-only) against the dev database (5433, in sync) and
   applied there with `migrate deploy`, so the running dev server keeps working.

Commits: `9756931` ui (selection, PaginationBar, card), `be7286c` web selection + store, `dd2f0b0`
db + kana schema, `4c447a0` invite / edit / profile with the name parts, `dfed1fd` display +
search + seeds, then this docs commit.

## Review round 3 (user, 2026-10-07): selection bar, pagination, card, select-all, search

1. **`SelectionBar` is gone**: the selected count had no use. The selection stays in the users store
   (the table writes it; CSV export will read it); `clearSelection` went with its only consumer.
2. **Pagination sits above the table**, in the card header, as the legacy `table/pagination.tsx`:
   `<< <` pages `> >>` as ghost icon buttons, the current page outlined in primary, a ページ box, no
   summary line, nothing with one page. `PaginationBar` lost `total`, `itemLabel` and
   `labels.summary`.
3. **`DataTable` is a `Card`** with a header (legacy `core/Card` + `DataTable`): `title` with the
   total in an outline `Badge` on the left, the pagination on the right; the users list titles
   it全担当者数.
4. **Select-all showed mixed when every row was selected**: TanStack v9's
   `getIsSomePageRowsSelected` is true for "all" too (v8 returned false), so the header box was
   `checked` and `indeterminate` at once, which Base UI renders as mixed. The table now passes
   `indeterminate` as some-and-not-all, and `checkbox.tsx` shows a minus while indeterminate (local
   patch 5 in `.claude/rules/ui.md`).
5. **`SearchInput` sits on `bg-card`**: the base `Input` is transparent (right for forms on cards),
   so on the blue-grey page it blended into the background.

Commits: `332c7e8` ui (card header, pagination bar, select-all, search surface), `70bfb81` web (the
users list on it), then this docs commit.

## Review round 4 (user, 2026-10-07): folders, filter button, form actions

1. **`components/` grouped by screen**: 20 files in one folder were past the point where flat helps.
   `users` now has `list/`, `form/`, `detail/` and `profile/`, with the badges and the status dialog
   (several screens) at the root; tests mirror it. romuten-v3 keeps small features flat and groups
   larger ones (`company/components/create/`, `worker/detail/`); the legacy d-round-web grouped
   every feature by screen. The rule (flat up to about eight, then by screen) is in
   `.claude/rules/ui.md`.
2. **Filter button**: outline buttons used `bg-background`, the page's own colour. The `outline`
   variant now uses `bg-card` (local patch 6), which fixes the filter trigger and every other
   outline button on the page background at once.
3. **Create / update actions at the bottom**: romuten-v3 has `StickyFormPage` (a form with its own
   scroll area, which needs the layout to be `h-svh overflow-hidden`) and a `sticky bottom-0` bar
   inside the normal page scroll (`HelloWorkBulkSendContainer`). The second fits this shell without
   changing how every page scrolls: composed `StickyBar` (reaches across the shell's new
   `--page-gutter`) and `FormActions` in `@repo/ui/components/form` (キャンセル as a child, submit
   with pending label, spinner and `aria-busy`). The invite and edit forms use them; the profile
   page keeps its inline buttons.

Commits: `a50c2fc` folders, `fc78e05` ui (outline, FormActions, StickyBar), `a848c95` web (shell
gutter, forms), then this docs commit.

4. **Bug found while checking the pages in the browser**: an untouched edit form enabled 保存 for
   every user but a manager. The shared fields registered `permissionKeys` on every form; under
   StrictMode (`next dev`) the remount left an `undefined` value that the default values of a
   non-manager lack, so `isDirty` was true. The key is now registered only with the permission
   field, and the update form tests render in StrictMode (`a888dce`).

## Out of scope (own tickets)

- User profile fields (社員番号, 氏名カナ, エリア, 地域, 部署, 役職, 退職日) and the `user_profiles`
  table; the list columns and form fields that need them.
- Image upload (`FileField` exists; the storage side does not). The `image` field is left out, not
  disabled.
- 担当クライアント / 担当スタッフ data, bulk actions, select column, feature store (`zustand`), CSV
  upload/download, print, user delete (`delete User`, row 1104, has no procedure).
- Aligning Better Auth's `/api/auth/admin/*` with the catalog (ADR 0003 follow-up).

## Risks and open points

- **Invite + overrides is two writes**: `auth.api.createUser` is Better Auth's, the overrides are
  ours. If the second fails the user exists without overrides; the service throws `ConflictError`
  (`"User created; permissions not saved"`) and the form shows it with a link to the user's update
  page. Acceptable for an admin-only flow; a `hooks.after` on `create-user` would not fix it either.
- **TanStack Table v9** (9.2.4): feature names (`rowSortingFeature`, `manualSorting`,
  `getToggleSortingHandler`) must be confirmed with Context7; if sorting cannot be made manual
  cleanly, fall back to a plain header button that calls `onChange` and keep the table unaware.
- `useSearchParams` in a client component needs a Suspense boundary for static prerendering; every
  `/admin` page is dynamic (session) and `loading.tsx` is a boundary, so no extra wrapper. Verify
  once on `next build` in step 7.
- `byId` now returns `permissionKeys` for `me` too (same service); harmless, but `profile-editor`
  types must still compile (they do: extra field).
- `user-editor.tsx` lives through steps 3–7 with a one-line change so each commit stays green; it
  disappears in step 8.
- The 15-file cap: step 9 is at 12; if the route-tree test or a shadcn addition (`accordion` is not
  installed; `permission-list.tsx` uses `Collapsible` + `CheckboxGroupField`) pushes it over, split
  the dialog into step 9b.
- The dev database on 5433 is diverged; the smoke run needs the seeded scratch stack on 5434
  (`local-dev-environment` notes).

## Smoke (after step 10, scratch stack on 5434)

super_admin: list sorts by 氏名, `?status=deactivated` shows the deactivated seed
user, 有効化 brings them back; create a manager with two extra permissions → detail shows them,
`permission-catalog` ability reflects them; edit → staff → overrides gone. manager:
`/admin/master/user` 403 (no `read User` grant), unchanged. admin: role select on create shows all
four.

## Outcome (2026-10-08)

- Branch `feature/D_ROUND-TBD_user-feature`: 36 commits on `develop` (this plan, API steps 1–3, the
  ui / web steps, four review rounds, the agent-training commit `5b2fc4c` and this close).
  Fast-forwarded into `develop` on 2026-10-08. Not pushed.
- `yarn verify` on `5b2fc4c`: 37/37 tasks (35 replayed from the green runs of the review rounds; the
  last commits are documentation only).
- Browser check: the users screens were opened in a headless browser against `next dev` during
  review round 4; that is how the untouched-edit-form bug (`a888dce`) was found.
- Review by the user: four rounds, recorded above — structure and reusable components (1),
  selection, pagination, card and name parts (2), selection bar, pagination position, select-all and
  search surface (3), folders, outline buttons and the sticky form actions (4).
- Security: `/security-review` was not run separately; the security-guidance plugin reviewed every
  turn of this branch on 2026-10-07 before it was switched off for the repo in `5b2fc4c`.
- Open (own tickets): CSV import / export on the users toolbar; 社員番号 / エリア / 地域 columns
  once `user_profiles` exists; the staff vs user split (`Staff.employeeType=USER`) is a proposal
  only; the auth `?next=` gap stays as listed in `docs/auth.md`.
- What slowed the ticket, and where it went: the legacy screen was not read before the design (three
  rounds of parity fixes), the feature layout was decided late (five move / group commits), screens
  went to review without a browser check, and pieces the legacy never had were built — now the
  `Legacy → new` table, the reference-first rule, the browser check and the `feature-screen` skill
  in `5b2fc4c`. Also: the Docker daemon's API hung during step 2 (steps reordered) and auto mode
  denied the implementer / reviewer subagents (steps done inline).

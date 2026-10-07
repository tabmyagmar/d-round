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

# ADR 0003 — Two-layer authorization (CASL + service rules)

Date: 2026-09-09 · Status: accepted

## Context

Authorization has two different questions: "may this role do this kind of thing?" (static, per role)
and "may this happen right now to this row?" (depends on data and workflow state). Mixing them
produces rules nobody can test.

## Decision

- **Layer 1 — CASL** (`packages/permissions`): `defineRules(can, user)` is written once and built
  twice — `defineAbilityFor` (browser, `createMongoAbility`, used only to hide UI) and
  `definePrismaAbilityFor` (`@casl/prisma/runtime`, API; `accessibleUsersWhere` turns the rules into
  a Prisma `where` for list endpoints). Actions
  `manage | create | read | update | delete | changeRole`, subject `User` (`all` for admins).
  Conditions are plain equalities (`id`) so both engines agree. Rules: admin manages all; everyone
  reads/updates self. Scoped roles are added as one `case` with an equality condition on a subject
  attribute plus a matrix row.
- **Layer 2 — services** (`apps/api/src/modules`): row-level and stateful checks ("cannot demote the
  last admin", workflow state) throw `ForbiddenError` / `ConflictError`. Workflow state is never
  encoded into CASL.
- Every non-public tRPC procedure runs an ability check (`requireAbility` in
  `apps/api/src/trpc/init.ts`); the ability matrix test `packages/permissions/test/ability.test.ts`
  is the permission spec.

## Alternatives

Better Auth admin-plugin statements as the only authorization (endpoint-level only, no row
conditions, not usable for list filtering); Cerbos/OpenFGA (extra service for one app, ADR 0001).

## Consequences

`@casl/prisma/runtime` imports `@prisma/client/extension`, so the web app must import the
browser-safe entry `@repo/permissions`; importing `@repo/permissions/server` from `apps/web` is a
lint error. Changing a permission means changing the matrix test first.

## Changes

- **2026-10-05** — Role grants come from the catalog (`role_permissions`) and per-user rows carry an
  `effect` (`PermissionEffect ALLOW | DENY`, ADR 0005). A user's effective grants are the role's
  `role_permissions` ∪ the user's `user_permissions` rows with `effect = ALLOW` − the user's rows
  with `effect = DENY`, computed in one Prisma query (`findEffectiveGrants` in
  `packages/database/src/repositories/permission.repository.ts`). A user row therefore adds or
  removes exactly one permission on top of the role, and a DENY wins over the role's grant of the
  same key; the legacy override semantics, where a user's rows replaced the role's rows entirely,
  are not copied. `permissions.visible` is a UI/menu filter for a future permission-editing screen
  and is never an authorization input: a hidden permission still grants, and the effective-grants
  query does not filter on it.
- **2026-10-06** — CASL rules come from the catalog. `defineRules` grants `can(action, subject)` for
  every effective grant on the session: `action` ∈
  `create | read | update | delete | status | changeRole` and `subject` = the catalog's `modelName`
  (`User`, `Client`, `Staff`, `Branch`, `AuditLog`, `Workflow`, `WorkflowTemplate`,
  `SourceCsvHistory`). A grant whose action or subject is outside those lists is ignored (fail
  closed, `isAction` / `isSubjectName`), and parent rows (`action = all`) never grant. `manage` is
  gone: no role has a wildcard, and super_admin and admin get identical rules because their catalog
  grants are identical. The self rule (`read` / `update` own row) stays the only hard-coded rule.
  `changeRole` stays its own action, fed by catalog row 1106 (ours), so a staff user never passes
  `requireAbility("changeRole")`; `deactivate` requires `status` (row 1105). Grants reach both
  abilities through Better Auth's `customSession` (`session.user.permissions`), one extra query per
  `getSession`; a Redis cache is a follow-up. The permission spec is split: the grant-driven unit
  spec in `packages/permissions/test/ability.test.ts` and the DB-backed
  `apps/api/test/permission-catalog.test.ts` (`role_permissions` = ability for every role × 43
  catalog rows). This entry supersedes the Decision's action/subject list (`manage`, `all` for
  admins), "admin manages all", scoped roles as a per-role `case`, and the Consequences rule "change
  the matrix test first": who may do what is now `permissions.csv` (the seed-test counts and the
  catalog test fail first), and a new rule shape starts in the unit spec. Scope: catalog grants
  shape the CASL ability, i.e. our tRPC API and the web UI. Better Auth's own `/api/auth/admin/*`
  endpoints (`create-user`, `set-role`, `ban-user`, `remove-user`, `revoke-user-sessions`) stay
  gated by the admin plugin's role map (`adminAc` for `super_admin` and `admin`), so a user `DENY`
  row does not narrow them and row 1101 does not gate `create-user`; aligning them with the grants
  (a `hooks.before` on `/admin/*`) is a follow-up ticket. `deactivate` (row 1105) deletes the
  target's sessions through the user repository in the same transaction as the soft delete, so it no
  longer depends on the caller's Better Auth role and a refused deactivation revokes nothing.
- **2026-10-06** — The web decides pages and navigation from a route catalog. Every page of
  `apps/web` has one entry in `apps/web/config/routes.ts` (`path`, `title`, `access` = `public`,
  `signed-in` or `{ action, subject }` on a catalog subject). One function, `canAccessRoute`
  (`apps/web/lib/auth/route-access.ts`), answers for both the sidebar (`visibleNavGroups`) and a
  server-side `PageGuard` that wraps every page under `/admin`, so a menu entry and its page agree
  for one session (the layout is not re-rendered on soft navigation: after a grant change the guard
  applies it at once and the menu on the next full load). It asks `canUnscoped`, not `ability.can`,
  because the self rule makes `can("read", "User")` true for everyone; a staff user therefore gets
  the 403 on `/admin/master/user/[id]` even for their own row and edits themselves at
  `/admin/profile`. The 403 renders in place (no redirect), before any HTML reaches the browser. A
  structural test (`apps/web/test/app/route-tree.test.ts`) keeps the catalog, the page tree and the
  guards in sync. It replaces `visibleNavItems` (`apps/web/components/app-shell.tsx`) as the web's
  navigation check and keeps the Decision's "browser ability only hides UI": the API's
  `requireAbility` and the service rules stay the guard.
- **2026-10-07** — Role and permission edits follow the legacy role picker. `assignableRoles(role)`
  (`@repo/validation`, next to `ROLES`) is the rule: `super_admin` and `admin` give admin, manager
  and staff; a manager gives manager and staff; staff gives nothing; `super_admin` is never given in
  the app. `user.invite` (row 1101) requires an assignable role. `user.changeRole` is replaced by
  `user.update` (`name?`, `role?`, `permissionKeys?`, one transaction, row `update` at layer 1): a
  role change also needs `changeRole` (row 1106), an assignable new role and an assignable current
  role — so a manager holding `changeRole` never demotes an admin and nobody changes a super_admin —
  plus the last-admin rule. Per-user overrides are written only for `OVERRIDABLE_ROLES` (`manager`,
  the legacy 権限（詳細設定） dialog) and only by callers holding `changeRole`: the client sends the
  ticked child keys and the service stores the difference to the role's grants as ALLOW / DENY rows
  (replace-all, `assigned_by` = the caller), so the storage semantics of the 2026-10-05 entry are
  unchanged; a user leaving an overridable role loses their rows. `permission.catalog`
  (`changeRole User`) serves the visible catalog grouped by parent with each child's roles;
  `user.byId` returns the user's effective keys (`permissionKeys`). Two escalation guards: nobody
  changes their own overrides, and a caller may only ALLOW a permission their own session grants
  (admins hold every catalog row, so it narrows only managers holding `changeRole`).
- **2026-10-08** — A second hard-coded row rule for personal data: everyone may `create`, `read`,
  `update` and `delete` the `CommentTemplate` rows they own (`{ createdBy: user.id }`, ADR 0006),
  and nobody else's. No catalog row grants it, as the legacy granted `Settings_*` to every signed-in
  user outside its permission table. `CommentTemplate` joins `SUBJECT_NAMES` (catalog `modelName`s ⊂
  the typed list still holds), with `commentTemplateSubject` (browser),
  `prismaCommentTemplateSubject` and `accessibleCommentTemplatesWhere` (server). Procedures use
  `requireAbility(action, "CommentTemplate")`, which the conditional rule passes for every signed-in
  user, the service checks the row and lists filter in the database with the owner `where`; route
  access to 定型文管理 stays `"signed-in"` because `canUnscoped` is false for a conditional rule.
  The unit spec asks `User` and `CommentTemplate` on an own and a foreign row.
- **2026-10-08** — A third hard-coded rule for reference data: every signed-in user may `read`
  `Source` (regions, prefectures, the post-code master), nobody writes it through the API. No
  catalog row fits — the legacy served `getSourceRegions` and the post-code lookup to every
  signed-in user (`authRequired`) — so `Source` joins `SUBJECT_NAMES` after `CommentTemplate` and
  the `source` router uses `requireAbility("read", "Source")`; the unit spec expects `read Source`
  for every signed-in holder. `canUnscoped` now takes any ability with `rulesFor` and is exported
  from `@repo/permissions/server` too: the user service requires the unconditional `update User`
  grant for 担当者 profile fields (ADR 0007), which the self rule does not give.

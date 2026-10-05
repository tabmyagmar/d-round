---
name: casl
description:
  Use when defining or changing CASL abilities, adding an ability check to a procedure, filtering a
  list with accessibleBy, or extending the permission spec.
---

# CASL abilities (packages/permissions)

CASL answers the coarse question "may this user do this kind of action on this kind of subject"; the
user's grants come from the session (role grants ∪ user `ALLOW` − user `DENY`). Everything that
depends on the current state of a row stays in services. The rule set, the actions, the subjects and
who may do what are in `.claude/rules/permissions.md`; the decision is
`docs/adr/0003-permissions.md`. This skill is the how-to.

## Shape

| File                                         | Exports                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules.ts`                               | `defineRules(can, user)`, `ACTIONS`, `SUBJECT_NAMES`, `isAction`, `isSubjectName`, `AbilityUser`, `PermissionGrant`, `CanFn`, `UserConditions` |
| `src/ability.ts` (`@repo/permissions`)       | `defineAbilityFor(user)` → `AppAbility` (`createMongoAbility`), `userSubject(record)`, `canUnscoped(ability, action, subject)`                 |
| `src/server.ts` (`@repo/permissions/server`) | `definePrismaAbilityFor(user)` → `ServerAbility`, `prismaUserSubject(row)`, `accessibleUsersWhere(ability, action)`, `accessibleBy`            |
| `src/react.tsx` (`@repo/permissions/react`)  | `AbilityProvider`, `Can`, `useAbility`                                                                                                         |
| `test/ability.test.ts`                       | the grant-driven unit spec (roles live in `permissions.csv`)                                                                                   |

The rules are written once (`defineRules`) and built twice: the browser ability hides UI, the Prisma
ability guards the API and filters lists. Conditions are plain equalities on subject attributes
(today only `id`) so both engines agree.

## How-to: change who may do what

Flip or add the row in `packages/database/prisma/seed/data/permissions.csv`; the seed-test counts
(`packages/database/test/seed/permissions.seed.test.ts`) and the DB-backed catalog test
(`apps/api/test/permission-catalog.test.ts`) document the change. No rule code changes. A new action
or subject is a new catalog value plus an entry in `ACTIONS` / `SUBJECT_NAMES` (the guards
`isAction` / `isSubjectName` ignore anything else, fail closed).

## How-to: add a rule shape (a scoped role)

1. Add the case to `test/ability.test.ts` first — it is the spec; the failing case documents the
   change.
2. Add one `can(action, subject, { attribute: user.attribute })` after the grant loop in
   `defineRules`; the attribute goes into `UserConditions`. Prefer whitelist rules; use `cannot`
   only to carve an exception out of a broad `can`.
3. Keep conditions to attributes CASL can evaluate on the subject object (`id`, `teamId`, ...). If
   you need to load something to decide, it is a service rule, not a CASL rule.
4. ADR line in `docs/adr/0003-permissions.md`.

## How-to: check in a router, a service, a list

- Router: every non-public procedure is `protectedProcedure.use(requireAbility(action, subject))`
  (`apps/api/src/trpc/init.ts`; example `apps/api/src/trpc/routers/user.router.ts`). A missing check
  is a reviewer BLOCKER.
- Service row check: `ctx.ability.can(action, prismaUserSubject(row))`, throwing `ForbiddenError`
  (`assertCan` in `apps/api/src/modules/user/user.service.ts`). The service re-checks the type-level
  ability too; it never assumes the router did.
- List: guard with `ctx.ability.can("read", "User")`, then compose
  `accessibleUsersWhere(ctx.ability, "read")` with the service's own filters and hand the Prisma
  `where` to the repository (`list` in `user.service.ts`). Never filter in memory.
- Web: `AbilityProvider user={user}` once in the shell (`apps/web/components/layout/app-shell.tsx`),
  `<Can I="..." a="...">` to hide UI, and pages and the sidebar through the route catalog:
  `canAccessRoute(ability, route)` (`apps/web/lib/auth/route-access.ts`, `canUnscoped` underneath)
  for `PageGuard` and `visibleNavGroups`. A new subject reaches the web as `{ action, subject }` in
  `apps/web/config/routes.ts`. UI hiding is never the only guard.

## The spec is two tests

- `test/ability.test.ts` — grant-driven, role-free: one `it` per single grant comparing a keyed map
  of every action × subject × relation (`holder`, `browserAnswers`, `expectedFor`); grants it does
  not know (`all`, `manage`, unknown subjects) allow nothing; the self rule alone; anonymous →
  nothing; `definePrismaAbilityFor` ≡ `defineAbilityFor`; `canUnscoped`; `accessibleUsersWhere`.
- `apps/api/test/permission-catalog.test.ts` — DB-backed: for every role × catalog row the ability
  equals "a `role_permissions` row exists"; user `ALLOW` adds, `DENY` removes; a parent row (`all`)
  never grants.

## Gotchas

- Never encode workflow state (submission status, approval step) into CASL.
- `userSubject(record)` / `prismaUserSubject(row)` (`subject("User", ...)`) is required for
  condition rules to see the subject type; a raw object silently yields `false`.
- `ability.can(action, "User")` on the bare type is true as soon as any rule exists, including the
  conditional self rule — use `canUnscoped` when the question is "every row".
- `accessibleUsersWhere` on an ability with no matching rule returns a fail-closed marker that
  Prisma rejects — always guard with `ability.can(action, "User")` first.
- `@repo/permissions/server` imports `@prisma/client/extension`; the web app and `packages/ui` may
  only import `@repo/permissions` and `@repo/permissions/react` (lint-enforced).
- Catalog grants govern this ability only; Better Auth's `/api/auth/admin/*` endpoints stay gated by
  the admin plugin's role map (ADR 0003).

# ADR 0003 — Two-layer authorization (CASL + service rules)

Date: 2026-09-09 · Status: accepted

## Context

Authorization has two different questions: "may this role do this kind of thing?" (static, per
role) and "may this happen right now to this row?" (depends on data and workflow state). Mixing
them produces rules nobody can test.

## Decision

- **Layer 1 — CASL** (`packages/permissions`): `defineRules(can, user)` is written once and built
  twice — `defineAbilityFor` (browser, `createMongoAbility`, used only to hide UI) and
  `definePrismaAbilityFor` (`@casl/prisma/runtime`, API; `accessibleUsersWhere` turns the
  rules into a Prisma `where` for list endpoints). Actions
  `manage | create | read | update | delete | changeRole`, subject `User` (`all` for admins).
  Conditions are plain equalities (`id`) so both engines agree. Rules: admin manages all;
  everyone reads/updates self. Scoped roles are added as one `case` with an equality condition on
  a subject attribute plus a matrix row.
- **Layer 2 — services** (`apps/api/src/modules`): row-level and stateful checks ("cannot demote
  the last admin", workflow state) throw `ForbiddenError` / `ConflictError`. Workflow state is
  never encoded into CASL.
- Every non-public tRPC procedure runs an ability check (`requireAbility` in `apps/api/src/trpc/init.ts`);
  the ability matrix test `packages/permissions/test/ability.test.ts` is the permission spec.

## Alternatives

Better Auth admin-plugin statements as the only authorization (endpoint-level only, no row
conditions, not usable for list filtering); Cerbos/OpenFGA (extra service for one app, ADR 0001).

## Consequences

`@casl/prisma/runtime` imports `@prisma/client/extension`, so the web app must import the
browser-safe entry `@repo/permissions`; importing `@repo/permissions/server` from `apps/web` is a
lint error. Changing a permission means changing the matrix test first.

## Changes

- **2026-10-05** — Role grants come from the catalog (`role_permissions`) and per-user rows carry
  an `effect` (`PermissionEffect ALLOW | DENY`, ADR 0005). A user's effective grants are the role's
  `role_permissions` ∪ the user's `user_permissions` rows with `effect = ALLOW` − the user's rows
  with `effect = DENY`, computed in one Prisma query (`findEffectiveGrants` in
  `packages/database/src/repositories/permission.repository.ts`). A user row therefore adds or
  removes exactly one permission on top of the role, and a DENY wins over the role's grant of the
  same key; the legacy override semantics, where a user's rows replaced the role's rows entirely,
  are not copied. `permissions.visible` is a UI/menu filter for a future permission-editing screen
  and is never an authorization input: a hidden permission still grants, and the effective-grants
  query does not filter on it.

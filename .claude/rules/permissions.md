---
paths:
  - "packages/permissions/**"
  - "apps/api/src/trpc/**"
---

# Permissions — two layers, both required

Single tenant, one organization. Roles: `super_admin`, `admin`, `manager`, `staff` (Better Auth
admin plugin, `role` column on `users` with a foreign key to the `roles` catalog; the allowed set is
`ROLES` / `roleSchema` in `@repo/validation`, `ADMIN_ROLES` = the two admin roles). Add a role by
extending `ROLES` in `@repo/validation`, `roles` in `@repo/auth`, `ROLE_SEEDS`, a new role flag
column in `permissions.csv` (the seed's header check enforces it) with the seed-test counts,
`ROLE_LABELS` / `ROLE_TONES` in the web, and a migration inserting the `roles` row
(`INSERT … ON CONFLICT ("key") DO NOTHING`, as `20261005143913_align_users_role_with_roles` does): a
migrations-only database has only the rows a migration inserted, and `users.role` references them
(ADR 0005). `rules.ts` and the unit spec know nothing about roles. The parity test in
`apps/api/test/role-catalog.test.ts` fails when the role lists disagree. Model:
`docs/adr/0003-permissions.md`.

## Layer 1 — CASL ability (`packages/permissions`)

Answers "may this user do this kind of thing to this kind of subject?" (from the user's grants). The
rules are written once in `packages/permissions/src/rules.ts` (`defineRules(can, user)`) and built
twice:

| Entry                      | Builder                                | Engine                                   | Used by                                    |
| -------------------------- | -------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `@repo/permissions`        | `defineAbilityFor(user)`               | `createMongoAbility` → `AppAbility`      | `apps/web` (hiding UI), the unit spec      |
| `@repo/permissions/server` | `definePrismaAbilityFor(user)`         | `@casl/prisma/runtime` → `ServerAbility` | `apps/api` (`ctx.ability`, list filtering) |
| `@repo/permissions/react`  | `AbilityProvider`, `Can`, `useAbility` | `@casl/react`                            | `apps/web` components                      |

Actions `create | read | update | delete | status | changeRole` (the catalog's `permissions.action`;
parent rows carry `all` and never grant). Subjects are the catalog's `modelName` values
(`SUBJECT_NAMES`: `User`, `Client`, `Staff`, `Branch`, `AuditLog`, `Workflow`, `WorkflowTemplate`,
`SourceCsvHistory`; only `User` has a Prisma model today). Conditions are plain equalities on
subject attributes (today only `id`) so both engines interpret them identically.

### The rule set (`rules.ts`)

```ts
export const defineRules = (can: CanFn, user: AbilityUser): void => {
  // Catalog grants from the session (role grants ∪ user ALLOW − user DENY), validated once.
  for (const grant of user.permissions) {
    if (isAction(grant.action) && isSubjectName(grant.subject)) {
      can(grant.action, grant.subject);
    }
  }
  // Everyone may see and edit their own profile.
  can(["read", "update"], "User", { id: user.id });
};
```

`user.permissions` comes from Better Auth's `customSession` (`session.user.permissions`, built by
`findEffectiveGrants` in `@repo/database`): the role's `role_permissions` plus the user's `ALLOW`
rows minus its `DENY` rows. What each role gets is `permissions.csv`
(`packages/database/prisma/seed/data/`), today:

| Role                   | User                            | Client / Staff / Branch | Workflow, WorkflowTemplate, AuditLog, SourceCsvHistory |
| ---------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------ |
| `super_admin`, `admin` | every action incl. `changeRole` | every catalog row       | every catalog row                                      |
| `manager`              | self (`read`/`update`) only     | `read`                  | Workflow all five; SourceCsvHistory `create`, `read`   |
| `staff`                | self (`read`/`update`) only     | `read`                  | Workflow all five                                      |

An anonymous visitor (`defineAbilityFor(null)`) can do nothing. A scoped role (for example a team
lead who reads their own team) is one `can("read", "User", { teamId: user.teamId })` after the grant
loop (equality condition on a subject attribute) plus a spec row. Changing who may do what is a CSV
change (plus the seed-test counts and the DB-backed catalog test); changing the shape of a rule is a
spec change first.

Catalog grants shape this ability only — our tRPC API and the web UI. Better Auth's own
`/api/auth/admin/*` endpoints stay gated by the admin plugin's role map (`super_admin`, `admin`): a
user `DENY` row does not narrow them, and row 1101 does not gate `admin/create-user`. Aligning them
with the grants is a follow-up (ADR 0003).

`canUnscoped(ability, action, subject)` (`@repo/permissions`) answers "may this user do this to
every row" — the highest-priority rule without conditions is not inverted — for list pages and
navigation; `ability.can(action, subject)` alone is also true for the conditional self rule.

- `ctx.ability` is a `ServerAbility` built once per request by `definePrismaAbilityFor(ctx.user)` in
  `apps/api/src/core/context.ts`.
- **Never encode workflow state into CASL.** "May a staff user update a User" is CASL. "May this
  submission be approved in its current step by this approver" is a service rule.

## Layer 2 — stateful checks in services

Services own every rule that depends on data: ownership of a specific row, relations loaded from the
database, state machines (PENDING → APPROVED), "cannot demote the last admin", "you cannot
deactivate your own account". They throw `ForbiddenError` / `ConflictError` from
`apps/api/src/core/errors.ts`. A service never assumes the router already checked something — it
re-checks what matters for its own invariants.

Row-level checks tag the Prisma row with `prismaUserSubject` so CASL knows which rules apply:

```ts
// apps/api/src/modules/user/user.service.ts
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";

const assertCan = (ctx: RequestContext, action: "read" | "update" | "status", user: User): void => {
  if (!ctx.ability.can(action, prismaUserSubject(user))) {
    throw new ForbiddenError(`Not allowed to ${action} this user`);
  }
};
```

A raw object without the subject tag silently yields `false`.

## Every non-public tRPC procedure has an ability check

```ts
// apps/api/src/trpc/routers/user.router.ts
byId: protectedProcedure
  .use(requireAbility("read", "User"))
  .input(userIdSchema)
  .query(({ ctx, input }) => userService.getById(ctx, input.userId)),
```

- `protectedProcedure` (`apps/api/src/trpc/init.ts`) guarantees a signed-in user;
  `requireAbility(action, subjectName)` (same file) throws `ForbiddenError` when
  `ctx.ability.can(action, subjectName)` is false — "may this user attempt this kind of action at
  all"; the service decides about the concrete row.
- `publicProcedure` is only for endpoints that must work without a session (health).
- A non-public procedure without `requireAbility` is a reviewer `BLOCKER`.

## List endpoints filter in the database

```ts
if (!ctx.ability.can("read", "User")) {
  throw new ForbiddenError("Not allowed to list users");
}
const filters: Prisma.UserWhereInput[] = [accessibleUsersWhere(ctx.ability, "read")];
return createUserRepository(ctx.db).findMany({ page, perPage }, { AND: filters });
```

`accessibleUsersWhere(ability, action)` (`@repo/permissions/server`) wraps
`accessibleBy(ability, action).ofType("User")` and returns a `Prisma.UserWhereInput` the service
composes with its own filters and hands to the repository. **Guard with
`ability.can(action, "User")` first**: when no rule matches, `@casl/prisma` returns a fail-closed
marker condition that Prisma rejects at query time — the guard turns that into a clean
`ForbiddenError`. Never filter in memory after loading everything.

## The permission spec is two tests

- `packages/permissions/test/ability.test.ts` is the grant-driven unit spec: for every action ×
  subject a user holding only that grant `can` exactly that cell on other rows plus the self rule on
  their own row; grants with `all` or an unknown subject are ignored; empty grants → self only;
  anonymous → nothing; the Prisma ability answers exactly like the browser ability;
  `accessibleUsersWhere` and `canUnscoped` are covered. It knows nothing about roles.
- `apps/api/test/permission-catalog.test.ts` is the DB-backed catalog spec: after the seed, for
  every role × catalog row, `ctx.ability.can(action, modelName)` equals "a `role_permissions` row
  exists" (never for `all`), a user `ALLOW` adds and a `DENY` removes, and every catalog action and
  `modelName` is in the typed lists.

Changing who may do what means changing `permissions.csv` first (the failing counts in
`permissions.seed.test.ts` and the catalog test document the change); changing the shape of a rule
means changing the unit spec first, then `rules.ts`, then an ADR line in
`docs/adr/0003-permissions.md`.

## Web

```tsx
// apps/web/components/app-shell.tsx — once, around the signed-in app; CurrentUser carries
// id, role and the session's permissions, so it satisfies AbilityUser as is.
<AbilityProvider user={user}>{children}</AbilityProvider>
```

Navigation and list links use `canUnscoped(ability, "read", "User")` (`visibleNavItems` in
`app-shell.tsx`, tested in `apps/web/test/components/app-shell.test.ts`), never a role list.

```tsx
// apps/web/features/users/user-editor.tsx
const ability = useAbility();
const subject = userSubject({ id: user.data.id });
const canEdit = ability.can("update", subject);

<Can I="changeRole" a="User">
  <RoleCard />
</Can>;
```

`AbilityProvider`, `Can`, `useAbility` come from `@repo/permissions/react`; `userSubject` from
`@repo/permissions`. They hide buttons and routes for a better UX and are never the only guard: the
API check runs on every request regardless of what the UI showed. The browser must never import
`@repo/permissions/server` (it pulls in `@prisma/client/extension`) — `boundaries/dependencies`
rejects it from `apps/web` and `packages/ui`.

---
paths:
  - "packages/permissions/**"
  - "apps/api/src/trpc/**"
---

# Permissions — two layers, both required

Single tenant, one organization. Roles: `admin`, `member` (Better Auth admin plugin, `role` column
on `users`; the allowed set is `roleSchema` in `@repo/validation`). Add roles by extending
`ROLES` in `@repo/validation`, `roles` in `@repo/auth`, `rules.ts` and the matrix test together.
Model: `docs/adr/0003-permissions.md`.

## Layer 1 — CASL ability (`packages/permissions`)

Answers "may this role do this kind of thing to this kind of subject?". The rules are written once
in `packages/permissions/src/rules.ts` (`defineRules(can, user)`) and built twice:

| Entry                      | Builder                                | Engine                                   | Used by                                    |
| -------------------------- | -------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `@repo/permissions`        | `defineAbilityFor(user)`               | `createMongoAbility` → `AppAbility`      | `apps/web` (hiding UI), the matrix test    |
| `@repo/permissions/server` | `definePrismaAbilityFor(user)`         | `@casl/prisma/runtime` → `ServerAbility` | `apps/api` (`ctx.ability`, list filtering) |
| `@repo/permissions/react`  | `AbilityProvider`, `Can`, `useAbility` | `@casl/react`                            | `apps/web` components                      |

Actions `manage | create | read | update | delete | changeRole`, subject `User` (plus `all`).
Conditions are plain equalities on subject attributes (today only `id`) so both engines interpret
them identically.

### The rule set (`rules.ts`)

```ts
export const defineRules = (can: CanFn, user: AbilityUser): void => {
  switch (user.role) {
    case "admin":
      can("manage", "all");
      return;
    case "member":
      break;
  }
  // Everyone may see and edit their own profile.
  can(["read", "update"], "User", { id: user.id });
};
```

| Role     | read     | update   | changeRole / delete / create |
| -------- | -------- | -------- | ---------------------------- |
| `admin`  | everyone | everyone | yes (`manage all`)           |
| `member` | self     | self     | no                           |

An anonymous visitor (`defineAbilityFor(null)`) can do nothing. A scoped role (for example a
team lead who reads their own team) is one more `case` with an equality condition on a subject
attribute (`can("read", "User", { teamId: user.teamId })`) plus a matrix row.

- `ctx.ability` is a `ServerAbility` built once per request by `definePrismaAbilityFor(ctx.user)`
  in `apps/api/src/core/context.ts`.
- **Never encode workflow state into CASL.** "May a member update a User" is CASL. "May this
  submission be approved in its current step by this approver" is a service rule.

## Layer 2 — stateful checks in services

Services own every rule that depends on data: ownership of a specific row, relations loaded from
the database, state machines (PENDING → APPROVED), "cannot demote the last admin", "you cannot
deactivate your own account". They throw `ForbiddenError` / `ConflictError` from
`apps/api/src/core/errors.ts`. A service never assumes the router already checked something — it
re-checks what matters for its own invariants.

Row-level checks tag the Prisma row with `prismaUserSubject` so CASL knows which rules apply:

```ts
// apps/api/src/modules/user/user.service.ts
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";

const assertCan = (ctx: RequestContext, action: "read" | "update", user: User): void => {
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
  `ctx.ability.can(action, subjectName)` is false — "may this role attempt this kind of action at
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

## The ability matrix test is the permission spec

`packages/permissions/test/ability.test.ts` is table-driven: for each role × action × relation
(`self | other`) it asserts `can` / `cannot`, checks that the Prisma ability
answers exactly like the browser ability, and covers `accessibleUsersWhere`. Changing permissions
means changing the `allowed` table first (the failing row documents the change), then `rules.ts`,
then an ADR line in `docs/adr/0003-permissions.md`.

## Web

```tsx
// apps/web/components/app-shell.tsx — once, around the signed-in app
<AbilityProvider user={{ id: user.id, role: user.role }}>{children}</AbilityProvider>
```

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

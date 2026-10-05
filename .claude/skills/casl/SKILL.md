---
name: casl
description:
  Use when defining or changing CASL abilities, adding an ability check to a procedure, filtering a
  list with accessibleBy, or extending the permission spec.
---

# CASL abilities (packages/permissions)

## Purpose

CASL answers the coarse question "may this user do this kind of action on this kind of subject" (the
user's grants come from the session). Everything that depends on the current state of a row stays in
services. Rules: `.claude/rules/permissions.md`; decision: `docs/adr/0003-permissions.md`.

## Shape

| File                                         | Exports                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules.ts`                               | `defineRules(can, user)`, `ACTIONS`, `SUBJECT_NAMES`, `isAction`, `isSubjectName`, `AbilityUser`, `PermissionGrant`, `CanFn`, `UserConditions` |
| `src/ability.ts` (`@repo/permissions`)       | `defineAbilityFor(user)` → `AppAbility` (`createMongoAbility`), `userSubject(record)`, `canUnscoped(ability, action, subject)`                 |
| `src/server.ts` (`@repo/permissions/server`) | `definePrismaAbilityFor(user)` → `ServerAbility`, `prismaUserSubject(row)`, `accessibleUsersWhere(ability, action)`, `accessibleBy`            |
| `src/react.tsx` (`@repo/permissions/react`)  | `AbilityProvider`, `Can`, `useAbility`                                                                                                         |
| `test/ability.test.ts`                       | the grant-driven unit spec (roles live in `permissions.csv`)                                                                                   |

The rules are written once and built twice; conditions are plain equalities on subject attributes
(today only `id`) so the mongo and the Prisma engine agree.

```ts
// src/rules.ts
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

```ts
// src/server.ts
export const definePrismaAbilityFor = (user: AbilityUser | null): ServerAbility => {
  const builder = new AbilityBuilder<ServerAbility>(createPrismaAbility);
  if (user) {
    defineRules((action, subjectName, conditions) => {
      builder.can(action, subjectName, conditions);
    }, user);
  }
  return builder.build();
};

export const accessibleUsersWhere = (
  ability: ServerAbility,
  action: Action = "read",
): Prisma.UserWhereInput => accessibleBy(ability, action).ofType("User");
```

## How-to: write a rule

1. Who may do what is data: flip or add the row in
   `packages/database/prisma/seed/data/permissions.csv` first (the seed-test counts and
   `apps/api/test/permission-catalog.test.ts` document the change); no rule code changes for that. A
   new rule shape (a scoped role, e.g. a team lead reading their own team) starts with a case in
   `test/ability.test.ts` — the spec — then one `can(...)` with an equality condition after the
   grant loop.
2. Add the `can(...)` line in `defineRules`. Prefer whitelist rules; use `cannot` only to carve an
   exception out of a broad `can`. A new condition key goes into `UserConditions`.
3. Keep conditions to attributes CASL can evaluate on the subject object (`id`, `teamId`, ...). If
   you need to load something to decide, it is a service rule, not a CASL rule.
4. ADR line in `docs/adr/0003-permissions.md`.

## How-to: check in a router

```ts
// apps/api/src/trpc/init.ts
export const requireAbility = (action: Action, subjectName: SubjectName) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.ability.can(action, subjectName)) {
      throw new ForbiddenError(`Not allowed to ${action} ${subjectName}`);
    }
    return next();
  });
```

```ts
// apps/api/src/trpc/routers/user.router.ts
export const userRouter = router({
  changeRole: protectedProcedure
    .use(requireAbility("changeRole", "User"))
    .input(changeRoleSchema)
    .mutation(({ ctx, input }) => userService.changeRole(ctx, input)),
});
```

Every non-public procedure: `protectedProcedure` → `requireAbility` → service. A missing check is a
reviewer BLOCKER.

## How-to: check a row in a service

```ts
if (!ctx.ability.can("update", prismaUserSubject(targetRow))) {
  throw new ForbiddenError("Not allowed to update this user");
}
```

## How-to: filter a list

```ts
// apps/api/src/modules/user/user.service.ts
if (!ctx.ability.can("read", "User")) {
  throw new ForbiddenError("Not allowed to list users"); // fail-closed marker guard
}
const filters: Prisma.UserWhereInput[] = [accessibleUsersWhere(ctx.ability, "read")];
if (query.role) {
  filters.push({ role: query.role });
}
return createUserRepository(ctx.db).findMany({ page, perPage }, { AND: filters });
```

The service composes the `where`; the repository receives it as a Prisma type and adds
`deletedAt: null`. Never filter in memory after loading everything.

## The spec (`test/ability.test.ts` + `apps/api/test/permission-catalog.test.ts`)

The unit spec is grant-driven and knows nothing about roles: a user holding exactly one grant
`{ action, subject }` can that cell on other rows and nothing else, plus the self rule on their own
row; grants with `all` or an unknown subject are ignored. The DB-backed catalog test asserts, for
every role × `permissions.csv` row, that `ctx.ability.can(action, modelName)` equals "a
`role_permissions` row exists".

```ts
// One `it` per grant; the answer for every action × subject × relation is compared as a keyed
// map, so a failure names the exact cell.
const SINGLE_GRANTS = ACTIONS.flatMap((action) =>
  SUBJECT_NAMES.map((subject) => ({ action, subject })),
);

it.each(SINGLE_GRANTS)("$action $subject", (grant) => {
  expect(browserAnswers(defineAbilityFor(holder([grant])))).toEqual(expectedFor([grant]));
});
```

The same file asserts that grants it does not know (`all`, `manage`, unknown subjects) allow
nothing, the self rule alone, that `definePrismaAbilityFor` answers exactly like `defineAbilityFor`
for every cell, that an anonymous visitor can do nothing, `canUnscoped`, and that
`accessibleUsersWhere` restricts a user without the `read User` grant to their own row and leaves a
holder of that grant unrestricted.

## Gotchas

- Never encode workflow state (submission status, approval step) into CASL.
- `userSubject(record)` / `prismaUserSubject(row)` (`subject("User", ...)`) is required for
  condition rules to see the subject type; a raw object silently yields `false`.
- `accessibleUsersWhere` on an ability with no matching rule returns a fail-closed marker that
  Prisma rejects — always guard with `ability.can(action, "User")` first.
- `@repo/permissions/server` imports `@prisma/client/extension`; the web app and `packages/ui` may
  only import `@repo/permissions` and `@repo/permissions/react` (lint-enforced).
- Web `Can` hides UI only; the API check runs regardless.

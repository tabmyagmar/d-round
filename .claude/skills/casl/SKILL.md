---
name: casl
description: Use when defining or changing CASL abilities, adding an ability check to a procedure, filtering a list with accessibleBy, or extending the ability matrix test.
---

# CASL abilities (packages/permissions)

## Purpose

CASL answers the coarse question "may this role do this kind of action on this kind of subject".
Everything that depends on the current state of a row stays in services. Rules:
`.claude/rules/permissions.md`; decision: `docs/adr/0003-permissions.md`.

## Shape

| File                                         | Exports                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules.ts`                               | `defineRules(can, user)`, `ACTIONS`, `SUBJECT_NAMES`, `AbilityUser`, `UserConditions`                                               |
| `src/ability.ts` (`@repo/permissions`)       | `defineAbilityFor(user)` → `AppAbility` (`createMongoAbility`), `userSubject(record)`                                               |
| `src/server.ts` (`@repo/permissions/server`) | `definePrismaAbilityFor(user)` → `ServerAbility`, `prismaUserSubject(row)`, `accessibleUsersWhere(ability, action)`, `accessibleBy` |
| `src/react.tsx` (`@repo/permissions/react`)  | `AbilityProvider`, `Can`, `useAbility`                                                                                              |
| `test/ability.test.ts`                       | the matrix spec                                                                                                                     |

The rules are written once and built twice; conditions are plain equalities on subject attributes
(today only `id`) so the mongo and the Prisma engine agree.

```ts
// src/rules.ts
export const defineRules = (can: CanFn, user: AbilityUser): void => {
  switch (user.role) {
    case "admin":
      can("manage", "all");
      return;
    case "member":
      break;
  }
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

1. Add the row to the `allowed` table in `test/ability.test.ts` first (role × action → relations
   `self | other`). The test is the spec; the failing row documents the change. A scoped role
   (e.g. a team lead reading their own team) adds a relation such as `same-team` to the table.
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

## Matrix test (`test/ability.test.ts`)

```ts
const allowed: Record<Role, Partial<Record<Action, Relation[]>>> = {
  admin: { manage: ALL, create: ALL, read: ALL, update: ALL, delete: ALL, changeRole: ALL },
  member: { read: ["self"], update: ["self"] },
};

for (const role of ROLES) {
  for (const action of ACTIONS) {
    for (const relation of RELATIONS) {
      const expected = allowed[role][action]?.includes(relation) ?? false;
      it(`${role} ${expected ? "CAN" : "CANNOT"} ${action} User (${relation})`, () => {
        const ability = defineAbilityFor(me(role));
        expect(ability.can(action, userSubject(targets[relation](me(role))))).toBe(expected);
      });
    }
  }
}
```

The same file asserts that `definePrismaAbilityFor` answers exactly like `defineAbilityFor` for
every cell, that an anonymous visitor can do nothing, and what `accessibleUsersWhere` produces per
role.

## Gotchas

- Never encode workflow state (submission status, approval step) into CASL.
- `userSubject(record)` / `prismaUserSubject(row)` (`subject("User", ...)`) is required for
  condition rules to see the subject type; a raw object silently yields `false`.
- `accessibleUsersWhere` on an ability with no matching rule returns a fail-closed marker that
  Prisma rejects — always guard with `ability.can(action, "User")` first.
- `@repo/permissions/server` imports `@prisma/client/extension`; the web app and `packages/ui`
  may only import `@repo/permissions` and `@repo/permissions/react` (lint-enforced).
- Web `Can` hides UI only; the API check runs regardless.

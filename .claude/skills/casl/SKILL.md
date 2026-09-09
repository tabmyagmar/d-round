---
name: casl
description: Use when defining or changing CASL abilities, adding an ability check to a procedure, filtering a list with accessibleBy, or extending the ability matrix test.
---

# CASL abilities (packages/permissions, Phase 1)

## Purpose

CASL answers the coarse question "may this role do this kind of action on this kind of subject".
Everything that depends on the current state of a row stays in services. Rules:
`.claude/rules/permissions.md`.

## Shape (planned for Phase 1)

- `defineAbilityFor(user)` builds an `AppAbility` with `AbilityBuilder`: actions
  `manage | create | read | update | delete | changeRole`, subjects `User | all`.
- Rules use static conditions only: `can("update", "User", { id: user.id })`,
  `can("update", "User", { department: user.department })`, `can("manage", "all")` for admin.
- Isomorphic: the same package is imported by `apps/api` (checks) and `apps/web`
  (`Can` / `useAbility`).
- `accessibleBy` is re-exported from `@casl/prisma` and turns rules into a Prisma `where`.

<!-- Phase 1: add real example (defineAbilityFor with the four roles) -->

## How-to: write a rule

1. Add the row to the matrix test first (role × action × relation → can/cannot). The test is the
   spec; the failing row documents the change.
2. Add the `can(...)` / `cannot(...)` line in `defineAbilityFor`. Prefer whitelist rules; use
   `cannot` only to carve an exception out of a broad `can`.
3. Keep conditions to attributes CASL can evaluate on the subject object (`id`, `department`,
   `role`). If you need to load something to decide, it is a service rule, not a CASL rule.

## How-to: check in a router

Every non-public procedure: `protectedProcedure` → ability check → service. Phase 1 adds a
`requireAbility(action, subject)` helper for routers; a missing check is a reviewer BLOCKER.

<!-- Phase 1: add real example (requireAbility middleware + user.router.ts) -->

## How-to: filter a list

```ts
const where = { AND: [accessibleBy(ctx.ability, "read").User, { deletedAt: null }] };
return createUserRepository(ctx.db).findMany(input, where);
```

The service composes the `where`; the repository receives it as a Prisma type. Never filter in
memory after loading everything.

## Matrix test template

```ts
const cases: [Role, Action, Relation, boolean][] = [
  ["admin", "changeRole", "other-dept", true],
  ["hr_manager", "update", "same-dept", true],
  ["hr_manager", "update", "other-dept", false],
  ["member", "read", "self", true],
  ["member", "read", "other", false],
];

it.each(cases)("%s can %s %s -> %s", (role, action, relation, expected) => {
  const ability = defineAbilityFor(userWith(role));
  expect(ability.can(action, subject("User", targetFor(relation)))).toBe(expected);
});
```

## Gotchas

- Never encode workflow state (submission status, approval step) into CASL.
- `subject("User", plainObject)` is required for condition rules to see the subject type; a raw
  object silently yields `false`.
- Web `Can` hides UI only; the API check runs regardless.
- A CASL rule change is a behaviour change: matrix test, ADR line
  (`docs/adr/0003-permissions.md`, Phase 1), and a note in the MR description.

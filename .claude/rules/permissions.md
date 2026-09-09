---
paths:
  - "packages/permissions/**"
  - "apps/api/src/trpc/**"
---

# Permissions — two layers, both required

Single tenant, one organization. Roles: `admin`, `hr_manager`, `dept_head`, `member` (Better Auth
admin plugin + role field, Phase 1).

## Layer 1 — CASL ability (`packages/permissions`, Phase 1)

Answers "may this role do this kind of thing to this kind of subject?". `defineAbilityFor(user)`
returns an `AppAbility`; `ctx.ability` is built once per request in
`apps/api/src/core/context.ts` (placeholder `null` in Phase 0). Actions are coarse
(`manage | create | read | update | delete | changeRole`), subjects are model names (`User`,
`all`), conditions are static attributes of the user and the subject (`id`, `department`).

- Rules are declared once, isomorphic, and consumed by the API (checks) and the web app (hiding
  UI).
- List endpoints filter with `accessibleBy` (re-exported from `@casl/prisma`) passed into the
  repository's `where` — never by filtering in memory.
- **Never encode workflow state into CASL.** "May a dept_head update a User" is CASL. "May this
  submission be approved in its current step by this approver" is a service rule.

## Layer 2 — stateful checks in services

Services own every rule that depends on data: ownership of a specific row, department match loaded
from the database, state machines (PENDING → APPROVED), "cannot demote the last admin". They
throw `ForbiddenError` / `ConflictError` from `apps/api/src/core/errors.ts`. A service never
assumes the router already checked something — it re-checks what matters for its own invariants.

## Every non-public tRPC procedure has an ability check

```ts
byId: protectedProcedure
  .input(idSchema)
  // ability check — Phase 1: requireAbility("read", "User") from packages/permissions
  .query(({ ctx, input }) => userService.getById(ctx, input)),
```

- `protectedProcedure` (`apps/api/src/trpc/init.ts`) guarantees a signed-in user; the ability
  check guarantees the role may attempt the action; the service decides about the concrete row.
- `publicProcedure` is only for endpoints that must work without a session (health, sign-in).
- A non-public procedure without an ability check is a reviewer `BLOCKER`.

## The ability matrix test is the permission spec

`packages/permissions` contains one table-driven test: for each role × action × relation
(`self | other | same-dept | other-dept`) it asserts `can` / `cannot`. Changing permissions means
changing that table first (the failing row documents the change), then the rules. The file is
commented as the spec; `docs/adr/0003-permissions.md` (Phase 1) records the model.

## Web

`Can` / `useAbility` (Phase 1) hide buttons and routes for a better UX. They are never the only
guard: the API check runs on every request regardless of what the UI showed.

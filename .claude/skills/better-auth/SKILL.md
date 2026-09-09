---
name: better-auth
description: Use when configuring Better Auth, generating its Prisma models, reading the session on the server or client, or working with the admin plugin's roles.
---

# Better Auth (Phase 1)

## Purpose

Authentication (email + password, email verification, sessions) and role assignment for the single
organization. The library's API changes quickly: **read the current docs (Context7) before writing
any config — do not guess option names.**

## Where things live (Phase 1)

- `packages/auth` — the `betterAuth({ ... })` server config: Prisma adapter, email and password,
  admin plugin, session settings, additional user fields (`role`, `employeeCode?`, `department?`).
- `packages/auth/src/client.ts` — the React client (with the admin plugin's client part) used by
  `apps/web`.
- `apps/api` mounts the handler at `/api/auth/*` (Hono) and resolves the session in
  `apps/api/src/core/context.ts` to fill `ctx.user`.
- The auth tables (User, Session, Account, Verification) are Prisma models in
  `packages/database/prisma/schema.prisma`.

## How-to: generate or update the Prisma models

1. Update the Better Auth config (plugins, additional fields).
2. Run `npx @better-auth/cli@latest generate` from the workspace that holds the config and direct
   its output to `packages/database/prisma/schema.prisma` (check the current CLI flags).
3. Review the diff and keep the repo conventions (`@@map` snake_case, UUID v7 ids, `created_at`).
   Adjust mappings by hand where the generator differs — never rename fields Better Auth relies
   on.
4. Migration + ADR line as in the `prisma` skill (`yarn db:migrate:dev --name <name>`).

<!-- Phase 1: add real example (generated models with our mappings) -->

## How-to: read the session on the server

```ts
const session = await auth.api.getSession({ headers });
// session?.user carries id, email, role (+ additional fields); null when signed out
```

Call it once per request in `buildRequestContext` (the headers are already there); services
receive `ctx.user` and never call Better Auth for identity.

<!-- Phase 1: add real example (context.ts resolving session + ability) -->

## Admin plugin and roles

Roles `admin | hr_manager | dept_head | member` live on the user (default `member`). The admin
plugin has its own access-control API built from **statements** and **roles** objects — read the
current docs and use that API; do not invent a `roles: []` array. Better Auth roles gate the admin
plugin's own endpoints (set role, ban, revoke sessions); application authorization is CASL
(`.claude/rules/permissions.md`).

## Gotchas

- Email hooks (`sendVerificationEmail`) must **not** send inline: insert an `OutboxEmail` row and
  enqueue after commit (`.claude/rules/queue.md`).
- Cookies: the web origin is allowed with `credentials: true` (`apps/api/src/app.ts`); the tRPC
  client must send `credentials: "include"`. Same-parent-domain cookie settings are documented in
  `docs/adr/0002-auth.md` (Phase 1).
- Rate-limit `/api/auth/sign-in/*` with Redis (Phase 1).
- Revoking sessions on deactivation goes through the admin API, called from the service.
- Version pinning: check `npm view better-auth version` and the Prisma adapter compatibility
  before upgrading; record breaking changes in an ADR.

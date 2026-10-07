---
name: better-auth
description:
  Use when configuring Better Auth, generating its Prisma models, reading the session on the server
  or client, or working with the admin plugin's roles.
---

# Better Auth 1.7

Authentication (email + password, email verification, 7-day sessions) and role storage for the
single organization. The library's API changes quickly: **read the current docs (Context7, or the
installed `node_modules/better-auth/dist/**/*.d.mts` at the exact path you need) before writing any
config — do not guess option names.** Runtime behaviour (session lifetime, what ends a session,
several devices, password links): `docs/auth.md`. Decision record: `docs/adr/0002-auth.md`; roles
and grants: `.claude/rules/permissions.md`.

## Where things live

- `packages/auth/src/server.ts` — `createAuth(options)` wraps `betterAuth({...})`: `prismaAdapter`,
  `basePath: "/api/auth"`, `emailAndPassword` (`requireEmailVerification`, `disableSignUp` — no
  public sign-up), `emailVerification`, `session` 7 d / `updateAge` 1 d,
  `advanced.database.generateId: false` (Postgres makes UUID v7), optional `crossSubDomainCookies`,
  the admin plugin, and `customSession(fn, base)`: every session lookup runs one
  `findEffectiveGrants` query and adds `user.permissions` (`{ action, subject }[]`, ADR 0003).
- `packages/auth/src/access-control.ts` — `createAccessControl(defaultStatements)`, the `roles` map
  for the admin plugin's own endpoints, re-export of `ADMIN_ROLES` (defined in `@repo/validation`).
- `packages/auth/src/client.ts` — `createAuthReactClient(baseURL)` with
  `inferAdditionalFields<Auth>()`, `customSessionClient<Auth>()` (types `session.user.permissions`)
  and `adminClient({ ac, roles })`, `credentials: "include"`.
- `packages/auth/auth-cli.config.ts` — exists only for `npx auth generate`.
- `apps/api/src/index.ts` instantiates it (secret, `baseURL`, `trustedOrigins`, `cookieDomain`,
  `sendVerificationEmail` through the outbox); `apps/api/src/app.ts` mounts `auth.handler` on
  `/api/auth/*` behind CORS and the sign-in rate limiter; `apps/api/src/core/context.ts` resolves
  the session into `ctx.user`.
- Tables `users`, `sessions`, `accounts`, `verifications`: one model per file under
  `packages/database/prisma/schema/auth/` (`.claude/rules/migrations.md`, "Better Auth models").

## How-to: read the session

- API: `buildRequestContext` (`apps/api/src/core/context.ts`) calls
  `auth.api.getSession({ headers })` once per request and maps it with `toAuthUser` (`id`, `email`,
  `name`, `role`, `emailVerified`, `permissions`); services read `ctx.user` and never call Better
  Auth for identity.
- Web server components: `getServerSession()` (`apps/web/lib/auth/server.ts`) forwards the browser
  cookie to `/api/auth/get-session`; `toCurrentUser` keeps `role` and `permissions`.
- Browser: `authClient` (`apps/web/lib/auth/client.ts`) — `signIn.email`, `signOut`, `useSession`.

## How-to: create users and change roles

Public sign-up is disabled: users come from `auth.api.createUser` (server-side without headers it
needs no session; over HTTP it needs an admin role; it rejects a role outside the `roles` map and
applies `defaultRole` when none is given). In tests use `signedInUser` from
`apps/api/test/support.ts` — it creates a verified user with `createUser` and signs in; do not write
another variant. Changing a role in the app goes through `user.update` (our service: catalog row
1106, `assignableRoles`, the last-admin rule), not through the admin plugin's `setRole`. The app's
way to add a user is `user.invite` (no password; the invitation mail sets it), see below.

## How-to: password flows (invitation, forgot, reset, change)

- Every password link is Better Auth's reset token:
  `auth.api.requestPasswordReset({ body: { email, redirectTo } })` with `redirectTo` an **absolute**
  web URL in `trustedOrigins` (`webLinks.newPassword(ctx.webOrigin)` in the API;
  `window.location.origin + /new-password` in the browser). Better Auth mails
  `${API}/api/auth/reset-password/<token>?callbackURL=…`, which redirects to `/new-password?token=…`
  or `?error=INVALID_TOKEN`.
- `createAuth`'s `sendPasswordResetEmail({ user, url, purpose })` receives `purpose` `"invitation"`
  (no credential account yet) or `"reset"`; `createAuthEmailSenders`
  (`apps/api/src/modules/email/auth-emails.ts`) maps it to the outbox template. Deactivated users
  get nothing.
- Browser client methods (camel-cased paths): `authClient.requestPasswordReset`,
  `authClient.resetPassword({ newPassword, token })`,
  `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`,
  `authClient.signIn.email({ …, rememberMe })`. Japanese error text: `authErrorMessage`
  (`apps/web/features/auth/auth-errors.ts`).
- The password policy is `passwordSchema` (`@repo/validation`); the server side is the
  `hooks.before` middleware in `packages/auth/src/server.ts` over `PASSWORD_SETTING_PATHS`. A new
  endpoint that stores a password must be added to that set (its test in
  `packages/auth/test/auth.test.ts` proves it).

## How-to: the admin API on the caller's behalf

No service calls it today: `deactivate` soft-deletes the user and deletes its `sessions` rows
through the user repository in one transaction, so it depends on the catalog grant `status User`,
not on the caller's Better Auth role. If a service ever needs an admin endpoint, pass the request
headers (`ctx.auth.api.<endpoint>({ body, headers: ctx.headers })`) and remember the plugin checks
the caller's role in its own map, which ignores catalog grants and `DENY` rows (ADR 0003).

## How-to: generate or update the Prisma models

1. Update the Better Auth config (plugins, additional fields).
2. `npx auth@1.7.3 generate --config packages/auth/auth-cli.config.ts --output /tmp/better-auth.prisma -y`
   (the CLI package is `auth`, not `@better-auth/cli`).
3. Diff by hand against `packages/database/prisma/schema/auth/`: keep `@@map` snake_case, UUID v7
   ids, `created_at`, our own fields and relation fields (`.claude/rules/migrations.md` lists them).
   Never rename a field Better Auth relies on.
4. Migration + ADR line as in the `prisma` skill.

## Gotchas

- Email hooks (`sendVerificationEmail`, `sendPasswordResetEmail`) must **not** send inline:
  `sendEmail` writes an `OutboxEmail` row and enqueues after commit (`.claude/rules/queue.md`).
  `createUser` sends no mail; the resend endpoint (`/send-verification-email`) does.
- `customSession` runs on every `getSession` (one query); it does not catch: a failing grant lookup
  fails the session instead of signing someone in with no grants. A Redis cache is a follow-up.
- Cookies: CORS with `credentials: true` for `WEB_ORIGIN` on `/api/auth/*` and `/trpc/*`
  (`apps/api/src/app.ts`); the tRPC client and the auth client send `credentials: "include"`.
  Same-parent-domain cookie settings: `docs/adr/0002-auth.md`.
- `/api/auth/sign-in/*` is rate limited per IP with `RateLimiterRedis`
  (`apps/api/src/middleware/rate-limit.ts`, 10 attempts / minute, 60 s block, 429 + `Retry-After`).
- Error shapes in tests: `APIError` carries `status` (a string such as `"FORBIDDEN"`) and
  `body.code` (`EMAIL_PASSWORD_SIGN_UP_DISABLED`, `EMAIL_NOT_VERIFIED`,
  `YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE`); `packages/auth/test/auth.test.ts` shows the
  assertions.
- Version pinning: check `npm view better-auth version` and the Prisma adapter compatibility before
  upgrading; record breaking changes in an ADR.

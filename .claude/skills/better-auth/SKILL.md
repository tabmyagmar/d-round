---
name: better-auth
description:
  Use when configuring Better Auth, generating its Prisma models, reading the session on the server
  or client, or working with the admin plugin's roles.
---

# Better Auth 1.7

## Purpose

Authentication (email + password, email verification, 7-day sessions) and role storage for the
single organization. The library's API changes quickly: **read the current docs (Context7) before
writing any config — do not guess option names.** Decision record: `docs/adr/0002-auth.md`.

## Where things live

- `packages/auth/src/server.ts` — `createAuth(options)` wraps `betterAuth({...})`: `prismaAdapter`
  (`provider: "postgresql"`), `basePath: "/api/auth"`, `emailAndPassword` with
  `requireEmailVerification`, `emailVerification` (`sendOnSignUp`, `autoSignInAfterVerification`, 1
  h expiry), `session` 7 d / `updateAge` 1 d, `advanced.database.generateId: false` (Postgres makes
  UUID v7), optional `crossSubDomainCookies`, the admin plugin, and `customSession(fn, base)`: every
  session lookup runs one `findEffectiveGrants` query and adds `user.permissions`
  (`{ action, subject }[]`, ADR 0003). Public sign-up is off (`disableSignUp`).
- `packages/auth/src/access-control.ts` — `createAccessControl(defaultStatements)` and the four
  roles for the admin plugin's own endpoints; re-exports `ADMIN_ROLES` (`["super_admin", "admin"]`,
  defined in `@repo/validation`).
- `packages/auth/src/client.ts` — `createAuthReactClient(baseURL)`: `createAuthClient` (React) with
  `inferAdditionalFields<Auth>()`, `customSessionClient<Auth>()` (so `session.user.permissions` is
  typed) and `adminClient({ ac, roles })`, `credentials: "include"`.
- `packages/auth/auth-cli.config.ts` — exists only for `npx auth generate`.
- `apps/api/src/index.ts` instantiates it (`secret: env.BETTER_AUTH_SECRET`, `baseURL: env.API_URL`,
  `trustedOrigins: [env.WEB_ORIGIN]`, `cookieDomain: env.COOKIE_DOMAIN`); `apps/api/src/app.ts`
  mounts `auth.handler` on `GET|POST /api/auth/*` behind CORS and the sign-in rate limiter;
  `apps/api/src/core/context.ts` resolves the session into `ctx.user`.
- Tables `users`, `sessions`, `accounts`, `verifications` — one model per file under
  `packages/database/prisma/schema/auth/` (`user`, `session`, `account`, `verification`).

## Example: `createAuth` options (as the API and the tests call it)

```ts
const auth = createAuth({
  prisma: db,
  secret: env.BETTER_AUTH_SECRET, // >= 32 bytes; rotating it signs everyone out
  baseURL: env.API_URL, // cookies are set on this host
  trustedOrigins: [env.WEB_ORIGIN],
  ...(env.COOKIE_DOMAIN ? { cookieDomain: env.COOKIE_DOMAIN } : {}),
  // Outbox: row inside a transaction, job after commit; the worker sends the mail.
  sendVerificationEmail: async ({ user, url }) => {
    await sendEmail(
      { db, emailQueue, logger },
      {
        to: user.email,
        template: EMAIL_TEMPLATES.verification,
        payload: { name: user.name, url },
      },
    );
  },
});
```

## How-to: read the session on the server

```ts
// apps/api/src/core/context.ts
const session = await deps.auth.api.getSession({ headers: input.headers });
const user = session ? toAuthUser(session.user) : null;
// ...then: { user, ability: definePrismaAbilityFor(user), headers: input.headers, auth: deps.auth }
```

Call it once per request in `buildRequestContext`; services receive `ctx.user` (`AuthUser`: `id`,
`email`, `name`, `role`, `emailVerified`, `permissions`) and never call Better Auth for identity.
`toAuthUser` parses `role` with `roleSchema` and falls back to `DEFAULT_ROLE` for unknown strings.

In `apps/web`, `getServerSession()` (`apps/web/lib/auth/server.ts`) forwards the browser cookie to
`${NEXT_PUBLIC_API_URL}/api/auth/get-session`; the browser uses `authClient`
(`apps/web/lib/auth/client.ts`).

## How-to: call the admin API on behalf of the caller

No service calls the admin API today: `deactivate` soft-deletes the user (`deletedAt`, `banned`,
`banReason: "deactivated"`) and deletes its `sessions` rows through the user repository in one
transaction (ADR 0003), so it depends on the catalog grant `status User`, not on the caller's Better
Auth role. If a service ever needs an admin endpoint on the caller's behalf, pass the request
headers (`ctx.auth.api.<endpoint>({ body, headers: ctx.headers })`): the plugin then checks the
caller's own role in its role map, which ignores catalog grants and `DENY` rows.

## How-to: a signed-in user in tests

`apps/api/test/support.ts`:

```ts
export const signedInUser = async (harness, options = {}) => {
  const email = `${crypto.randomUUID()}@example.com`;
  // Server-side admin call (no headers → no session needed); `data` is spread into the row.
  await harness.auth.api.createUser({
    body: {
      email,
      password: TEST_PASSWORD,
      name: "Test User",
      role: options.role ?? DEFAULT_ROLE,
      data: { emailVerified: true },
    },
  });
  const user = await harness.db.user.findUniqueOrThrow({ where: { email } });
  const response = await harness.auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    asResponse: true,
  });
  return {
    user,
    email,
    headers: new Headers({ cookie: cookieHeaderFrom(response) }),
  };
};
```

`packages/auth/test/auth.test.ts` covers the real flow: `signUpEmail` is rejected with
`EMAIL_PASSWORD_SIGN_UP_DISABLED`; `createUser` applies `DEFAULT_ROLE`; `signInEmail` rejects with
`EMAIL_NOT_VERIFIED` before verification; `sendVerificationEmail` → `verifyEmail` returns
`Set-Cookie` and `getSession` resolves it, with `user.permissions` equal to the role's grants (a
user `DENY` row removes one, an `ALLOW` row adds one).

## How-to: generate or update the Prisma models

1. Update the Better Auth config (plugins, additional fields).
2. `npx auth@1.7.3 generate --config packages/auth/auth-cli.config.ts --output /tmp/better-auth.prisma -y`
   (the CLI package is `auth`, not `@better-auth/cli`).
3. Diff against the files under `packages/database/prisma/schema/auth/` by hand: keep `@@map`
   snake_case, UUID v7 ids, `created_at`, our extra fields. Never rename fields Better Auth relies
   on.
4. Migration + ADR line as in the `prisma` skill (`yarn db:migrate:dev --name <name>`).

## Admin plugin and roles

Roles `super_admin | admin | manager | staff` live on `users.role` (a string with a foreign key to
the `roles` catalog, default `staff`; `ROLES` / `ADMIN_ROLES` in `@repo/validation`). Public sign-up
is disabled (`emailAndPassword.disableSignUp`): users are created with `auth.api.createUser`, which
rejects a role outside the `roles` map. Extra profile fields go through `user.additionalFields` in
`createAuth` plus a schema migration (`.claude/rules/migrations.md`). The admin plugin's access
control (`ac`, `roles`, `adminRoles`) gates only the plugin's own endpoints (set role, ban, revoke
sessions); application authorization is CASL (`.claude/rules/permissions.md`). Changing a user's
role in the app goes through `user.changeRole` (our service, last-admin rule), not through the admin
plugin's `setRole`.

## Gotchas

- Email hooks (`sendVerificationEmail`) must **not** send inline: `sendEmail` writes an
  `OutboxEmail` row and enqueues after commit (`.claude/rules/queue.md`).
- Cookies: CORS with `credentials: true` for `WEB_ORIGIN` on `/api/auth/*` and `/trpc/*`
  (`apps/api/src/app.ts`); the tRPC client and the auth client send `credentials: "include"`.
  Same-parent-domain cookie settings: `docs/adr/0002-auth.md`.
- `/api/auth/sign-in/*` is rate limited per IP with `RateLimiterRedis`
  (`apps/api/src/middleware/rate-limit.ts`, 10 attempts / minute, 60 s block, 429 + `Retry-After`).
- Untrusted origins: Better Auth applies its own origin/CSRF checks; the HTTP tests cover CORS
  preflight (`apps/api/test/app.test.ts`), not a 4xx on a forged `Origin`.
- Version pinning: check `npm view better-auth version` and the Prisma adapter compatibility before
  upgrading; record breaking changes in an ADR.

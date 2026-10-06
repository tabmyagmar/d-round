# Plan: Port the legacy auth flows onto Better Auth — invitation, forgot/reset password, change password

Ticket: `feature/D_ROUND-TBD_auth` (one MR, seven commits, each green on its own, ≤15 files per
commit), branched from `develop` after `feature/D_ROUND-TBD_web-shell` was fast-forwarded into it
(2026-10-06; merging it waived that branch's two 16-file commits). Status: **approved 2026-10-06**
with every default below.

## Why auth first

Every screen that follows assumes a real user can get in: today users exist only through the seed or
an admin API call, there is no way to set, reset or change a password, and the admin "担当者追加"
screen cannot be built because a created user has no way to receive a password. The building blocks
exist (Better Auth endpoints, the outbox + worker mail pipeline, the `(auth)` placeholder pages, the
profile page), so this is a small ticket with the largest unblocking effect.

## Goal and acceptance criteria

Replace the legacy flows (hand-rolled JWT + bcrypt, AES reset tokens on the `users` row, plaintext
temporary passwords by mail, credentials kept in `localStorage`) with Better Auth's own flows,
mailed through the outbox, with Japanese copy taken from the legacy app.

- **Invitation** (replaces the legacy welcome mail with a temporary password): an admin creates a
  user with `email`, `name`, `role` and **no password**; the user
  receives 「アカウント登録のお知らせ」with a set-password link; opening it, choosing a password and
  signing in works end to end. A user who never set a password cannot sign in (there is no
  credential account), so the legacy "must change the first password" rule needs no flag.
- **Forgot password**: `/forgot-password` sends 「パスワード再設定のご案内」 to a registered address
  and shows the same confirmation whether or not the address exists (no enumeration); the link opens
  `/new-password?token=…`; an invalid or expired link opens `/new-password?error=INVALID_TOKEN` with
  the legacy wording and a link back to forgot-password. Tokens are random, stored in
  `verifications`, valid 1 hour, single use; every other session of the user is revoked on reset.
- **Admin re-send**: on `/admin/master/user/[id]` a user allowed `update User` can send the user a
  reset (or, for a user without a password, an invitation) mail again.
- **Change password** on `/admin/profile`: current + new + confirm; a wrong current password
  shows「現在のパスワードが正しくありません」; other sessions are revoked.
- **Password policy** in one place (`passwordSchema`, `@repo/validation`): 8–128 characters, at
  least one letter and one digit, Japanese messages — enforced in the browser forms **and** on the
  API for every path that sets a password (reset, change, admin set).
- **Login** in Japanese with 「ログイン状態を保持する」 (Better Auth `rememberMe`: unchecked → the
  session cookie ends with the browser) and one generic
  error 「メールアドレスまたはパスワードが正しくありません」; a deactivated user
  gets 「現在のアカウントではログインできません」; a rate-limited client
  gets 「試行回数が多すぎます…」.
- `POST /api/auth/request-password-reset` is rate limited per IP like sign-in.
- Mails share one branded, table-based HTML layout (ported from the legacy `_layout.html`), with
  Japanese subjects and bodies, and are tested in the worker.
- `yarn verify` green per commit; Postgres/Redis tests through testcontainers; no mocks of our code.

## Legacy → new

| Legacy (d-round-api / d-round-web)                                   | Here                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `login` mutation, JWT access/refresh, next-auth credentials provider | Better Auth `signIn.email` (cookie session), already in place                                 |
| `remember` → AES-encrypted credentials in `localStorage`             | `rememberMe` on sign-in (session-only cookie when off); credentials are never stored          |
| `forgotPassword` → AES token on `users`, 30 min, throws if unknown   | `requestPasswordReset` → random token in `verifications`, 1 h, same answer for any address    |
| `verifyResetPasswordToken` + `resetPassword(token, password)`        | `GET /api/auth/reset-password/:token?callbackURL` + `POST /reset-password`                    |
| `createUser` → random temporary password mailed in plaintext         | `createUser` without password + `requestPasswordReset` → invitation mail with a set link      |
| `resetFirstPassword` flag + proxy redirect to `/new-password`        | no credential account until the user sets a password → cannot sign in before                  |
| `sendResetPasswordLink(id)` (admin), `ALREADY_SENT` within 30 min    | `user.sendPasswordReset` (tRPC, `update User`); Better Auth replaces the previous token       |
| `changePassword(oldPassword, newPassword)`, `USED_PASSWORD`          | `changePassword({ currentPassword, newPassword, revokeOtherSessions })`; same-password refine |
| `PasswordSchema` 8–20, digit + lowercase, ASCII whitelist            | `passwordSchema` 8–128, letter + digit (decision 4)                                           |
| nodemailer + handlebars layout/partials, Gmail or relay              | outbox row → worker → SMTP (Mailpit in dev); layout ported as functions                       |
| `STATUS_INACTIVE` on login                                           | `deactivate` already sets `banned: true` → admin plugin refuses sign-in (`BANNED_USER`)       |

## Decisions (all defaults confirmed by the user, 2026-10-06)

1. **Invitation = password-reset link.** One Better Auth flow serves the invitation, forgot password
   and the admin re-send. The mail template is chosen by the user's state in the `sendResetPassword`
   callback: no credential account yet → 「アカウント登録のお知らせ」,
   otherwise「パスワード再設定のご案内」. No temporary password is ever mailed.
2. **A mailed token proves the mailbox**: `onPasswordReset` marks `emailVerified` when it was false,
   so an invited user is verified by setting the password. `requireEmailVerification` stays on.
   Consequence: the template's `/verify-email` page, the resend form and the login form's
   "unverified" branch have no flow left and are removed (the `verification-email` template and
   callback stay for a user created with a password but unverified: their self-service path is
   forgot-password). ADR 0002 line.
3. **Token lifetime 1 hour** for both invitation and reset (Better Auth has one setting). An expired
   invitation is recovered by the admin re-send or by the user through forgot-password; the
   invitation mail says so.
4. **Password policy** 8–128 characters with at least one letter and one digit, Japanese messages,
   no character whitelist and no 20-character cap (NIST: allow long passwords). Enforced server-side
   by a Better Auth `hooks.before` on `/reset-password`, `/change-password`, `/set-password` and
   `/admin/set-user-password`.
5. **Sessions revoked** on reset (`revokeSessionsOnPasswordReset`) and on change
   (`revokeOtherSessions: true`).
6. **`rememberMe` checkbox default on** (7-day session, as today); unchecked gives a browser-session
   cookie. The legacy `localStorage` credentials feature is not ported.
7. **Rate limit** `POST /api/auth/request-password-reset`: 5 requests per 15 minutes per IP,
   15-minute block (sign-in keeps 10/min). Better Auth's identical "if this email exists" answer
   covers enumeration.
8. **`user.invite` is part of this ticket** (service + router, `create User`, catalog row 1101),
   because it owns the invitation mail; its screen (担当者追加) comes with the master screens.
9. **Legacy MySQL password hashes are not migrated here.** If the data migration decision lands on
   "migrate users", Better Auth's `emailAndPassword.password.verify` can accept `bcrypt` hashes
   (`$2a$`/`$2b$`) next to scrypt — a follow-up ticket with its own ADR line.
10. **Japanese zod messages only on the new password rules**; the rest of `@repo/validation` keeps
    its default messages until a zod error-map pass (follow-up).

## Design

### Better Auth (`packages/auth/src/server.ts`)

```ts
emailAndPassword: {
  …,
  sendResetPassword: ({ user, url }) => options.sendPasswordResetEmail({ user, url }),
  resetPasswordTokenExpiresIn: 60 * 60,
  revokeSessionsOnPasswordReset: true,
  onPasswordReset: async ({ user }) => users.markEmailVerified(user.id),   // decision 2
},
hooks: { before: passwordPolicyHook },   // parses body.newPassword with passwordSchema on the 4 paths
```

`CreateAuthOptions` gains `sendPasswordResetEmail({ user, url }): Promise<void>`; the API wires it
to the outbox in `apps/api/src/index.ts`, choosing the template with
`createUserRepository(db).hasCredentialAccount(user.id)` (decision 1). `markEmailVerified` and
`hasCredentialAccount` are two small methods on the user repository (`packages/database`).

Endpoints used (Better Auth 1.7.3, checked in `node_modules/better-auth/dist/api/routes`):
`POST /request-password-reset { email, redirectTo }` (always 200 with the same message),
`GET /reset-password/:token?callbackURL` (redirects to `callbackURL?token=…` or
`?error=INVALID_TOKEN`), `POST /reset-password { newPassword, token }` (creates the credential
account when the user has none),
`POST /change-password { currentPassword, newPassword, revokeOtherSessions }`,
`POST /sign-in/email { …, rememberMe }`, `auth.api.createUser` without `password` (links no
account). Verify the browser client's method names (`authClient.requestPasswordReset`,
`resetPassword`, `changePassword`) in `node_modules/better-auth/dist/client` before writing the
forms.

### Mail (`packages/queue`, `apps/worker`)

`EMAIL_TEMPLATES`: `verification-email` (kept, Japanese copy), `password-reset` (`{ name, url }`),
`account-invitation` (`{ name, url }`). `apps/worker/src/mail/layout.ts` ports the legacy shell
(600px table, brand `#062c9b`, eyebrow/title/footer note, `text`, `button`, `caution` helpers,
HTML-escaped values); `templates.ts` renders the three with the legacy subjects
(「D-Round」アカウント パスワード変更のご案内, 「D-Round ご利用登録のお知らせ」 — brand from
`MAIL_FROM`) and a plain-text alternative.

### API (`apps/api`)

- `RequestContext` gains `webOrigin` (from `WEB_ORIGIN`, through `ContextDeps`), and
  `apps/api/src/core/web-links.ts` builds the one web URL the API mails: `newPassword(origin)` →
  `${origin}/new-password` (the API cannot import the web catalog; the path literal is noted in the
  web catalog as "also in apps/api/src/core/web-links.ts").
- `user.service.ts`: `invite(ctx, { email, name, role })` — `create User`; `createUser` without
  password, then `ctx.auth.api.requestPasswordReset({ body: { email, redirectTo } })`; returns the
  user. `sendPasswordReset(ctx, userId)` — `update User` + row check (`assertCan`), refuses a
  deactivated user (`ConflictError`), then `requestPasswordReset`. Both go through Better Auth
  server-side (no caller headers needed), so DENY rows and the catalog decide, not the admin
  plugin's role map.
- `user.router.ts`: `invite: protectedProcedure.use(requireAbility("create","User"))`,
  `sendPasswordReset: …requireAbility("update","User")`.
- `middleware/rate-limit.ts`: `PASSWORD_RESET_RATE_LIMIT`; `app.ts` applies it to
  `/api/auth/request-password-reset`.

### Web (`apps/web`)

- `features/auth/login-form.tsx` — Japanese copy and the legacy description, `rememberMe`
  (`CheckboxField`), `authErrorMessage(error)` from `features/auth/auth-errors.ts` (pure map:
  `INVALID_EMAIL_OR_PASSWORD`, `BANNED_USER`, `EMAIL_NOT_VERIFIED`, 429 → Japanese; tested).
- `features/auth/forgot-password-form.tsx` —
  `authClient.requestPasswordReset({ email, redirectTo: origin + href(routes.auth.newPassword) })`;
  success state with the legacy confirmation text.
- `features/auth/new-password-form.tsx` — props `{ token }`;
  `authClient.resetPassword({ newPassword, token })`; success → 「ログイン画面へ」. The page reads
  `token` / `error` from `searchParams` through a pure `newPasswordState(params)`
  (`"form" | "invalid"`, tested) and renders the legacy "URL already used / expired" message with a
  link to forgot-password when invalid.
- `features/users/password-change-form.tsx` —
  `changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`, rendered as a
  second card by `profile-editor.tsx`.
- `features/users/user-editor.tsx` — 「パスワード再設定メールを送信」 (`<Can I="update" a="User">`,
  `ConfirmDialog`, `trpc.user.sendPasswordReset`).
- Removed (decision 2): `app/(auth)/verify-email/page.tsx`, `features/auth/resend-verification.tsx`,
  `routes.auth.verifyEmail` (the route-tree test enforces the catalog ↔ pages parity).
- Validation (`@repo/validation`): `passwordSchema` (policy), `signInSchema` + `rememberMe`,
  `forgotPasswordSchema`, `resetPasswordSchema` (`newPassword`, `confirmPassword`, refine equal),
  `changePasswordSchema` (+ refine new ≠ current, the legacy `USED_PASSWORD`), `inviteUserSchema`.

## Steps (commits)

### 1. `feat(validation): password policy and auth form schemas` (3 files)

`packages/validation/src/user.schema.ts` (schemas above, Japanese messages on the password rules),
`packages/validation/test/user.schema.test.ts` (tests first: accepts `Abcd1234`, rejects `12345678`,
`abcdefgh`, 7 chars, 129 chars; confirm mismatch; new = current), `README.md` or none.

### 2. `feat(mail): branded Japanese templates for verification, reset and invitation` (5 files)

`packages/queue/src/jobs/email.job.ts` (templates + payload types),
`apps/worker/src/mail/layout.ts`, `apps/worker/src/mail/templates.ts`,
`apps/worker/test/mail/templates.test.ts` (tests first: subject per template, the url and name
present and escaped, unknown template / bad payload → `TemplateError`),
`apps/worker/test/processors/email.processor.test.ts` only if a fixture changes.

### 3. `feat(auth): password reset, invitation mail and policy hook in Better Auth` (≤15 files)

`packages/auth/src/server.ts`, `packages/auth/src/index.ts` (types),
`packages/auth/test/auth.test.ts` (tests first: request → one callback with a url, same 200 for an
unknown email and no callback; reset → new password works, old sessions gone, `emailVerified` true;
reused/invalid token → `INVALID_TOKEN`; `createUser` without password → sign-in refused → reset link
sets the password; policy hook rejects `12345678` on reset and change; `changePassword` wrong
current → `INVALID_PASSWORD`), `packages/database/src/repositories/user.repository.ts`
(`hasCredentialAccount`, `markEmailVerified`) +
`packages/database/test/repositories/user.repository.test.ts`, `apps/api/src/index.ts` (callback →
outbox, template by account state), `apps/api/src/middleware/rate-limit.ts`, `apps/api/src/app.ts`,
`apps/api/test/support.ts` (capture `sentPasswordResets`), `apps/api/test/auth-http.test.ts` (outbox
row with `account-invitation` for a password-less user and `password-reset` for one with a password;
429 with `Retry-After`).

### 4. `feat(user): invite a user and send a password reset` (≤10 files)

`apps/api/src/core/context.ts` (`webOrigin`), `apps/api/src/core/web-links.ts`,
`apps/api/src/app.ts` or `index.ts` (pass `webOrigin` into the context deps),
`apps/api/src/modules/user/user.service.ts`, `apps/api/src/trpc/routers/user.router.ts`,
`apps/api/test/modules/user/user.service.test.ts` (invite creates an unverified user with the role
and no account, writes one invitation row; duplicate email → `ConflictError`; `sendPasswordReset` on
a deactivated user → `ConflictError`; without the grant → `ForbiddenError`),
`apps/api/test/trpc/routers/user.router.test.ts`, `apps/api/test/support.ts` if the harness needs
`webOrigin`.

### 5. `feat(web): login, forgot-password and new-password in Japanese on Better Auth` (≤15 files)

`features/auth/{login-form,forgot-password-form,new-password-form}.tsx`,
`features/auth/auth-errors.ts`, `features/auth/new-password-state.ts`,
`app/(auth)/{login,forgot-password,new-password}/page.tsx`, `app/(auth)/layout.tsx` (legacy
description text under the brand), `config/routes.ts` (drop `verifyEmail`), delete
`app/(auth)/verify-email/page.tsx` and `features/auth/resend-verification.tsx`, tests
`test/features/auth/auth-errors.test.ts`, `test/features/auth/new-password-state.test.ts`,
`test/config/routes.test.ts` (auth routes list).

### 6. `feat(web): change password and admin re-send on the user pages` (4 files)

`features/users/password-change-form.tsx`, `features/users/profile-editor.tsx`,
`features/users/user-editor.tsx`, `test/features/users/password-change-form.test.tsx` (jsdom:
renders the three fields and shows the mismatch message; the submit is not exercised).

### 7. `docs: auth flows on Better Auth` (≤7 files)

`docs/adr/0002-auth.md` (dated line: reset/invitation flow, mailbox-proof verification, policy hook,
revoke on reset, `rememberMe`, removed verify-email page), `.claude/rules/permissions.md` (`invite`
→ 1101, `sendPasswordReset` → 1103), `.claude/skills/better-auth/SKILL.md` (how-to: reset, invite,
policy hook, client method names), `.claude/rules/queue.md` (template list pointer),
`.claude/rules/ui.md` (features/auth files), `README.md` (flows, Mailpit), the user-module template
if it gains a step.

Manual smoke (Mailpit at `localhost:8025`, API on the scratch database, worker running): invite a
user from a super_admin session → mail → set password → login → change password → forgot password →
mail → reset → old session gone → login.

## Risks and open points

- Better Auth client method names and the `redirectTo` origin check: `redirectTo` must be an
  absolute web URL in `trustedOrigins`; a relative path would redirect to the API origin.
- `onPasswordReset` runs after the password update, outside a transaction: a failed
  `markEmailVerified` leaves a user with a password but unverified; their path is forgot-password
  again (idempotent). Logged.
- The policy hook must match the exact endpoint paths (`ctx.path`); a renamed path in a Better Auth
  upgrade would silently drop the server-side check — the `packages/auth` tests cover each path.
- `resetPasswordTokenExpiresIn` is one value for invitation and reset (decision 3).
- Removing `/verify-email` changes template behaviour; the `template` branch is unaffected.
- The worker needs a running Redis and Mailpit for the smoke test; tests use testcontainers.

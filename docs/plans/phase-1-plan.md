# Phase 1 plan — auth, user module, permissions, first real job

**Status: DRAFT — waiting for human approval (protocol.md, Step 1).**
Source: `phase-0-1-claude-code-prompts.md` §F. Assumptions from §B: single tenant, GitHub Actions,
`@repo/*` namespace. Phase 0 is committed and `yarn verify` is green.

## Versions (checked 2026-09-09 with `npm view <pkg> version`)

| Package                                   | Version        | Notes                                                                                   |
| ----------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `better-auth`                             | 1.7.3          | `prismaAdapter`, `emailAndPassword`, `emailVerification`, admin plugin (access control) |
| `@better-auth/cli`                        | 1.4.21         | `generate` → Prisma models (User, Session, Account, Verification)                       |
| `@casl/ability` / `@casl/prisma`          | 7.0.1 / 2.0.2  | `@casl/prisma` 2 supports Prisma 7 and requires `@casl/ability` 7                       |
| `@casl/react`                             | 7.0.1          | `Can` component / `useAbility`                                                          |
| `rate-limiter-flexible`                   | 11.2.0         | `RateLimiterRedis` on the shared ioredis connection                                     |
| `nodemailer` / `@types/nodemailer`        | 10.0.1 / 8.0.1 | SMTP → Mailpit in dev                                                                   |
| `react-hook-form` / `@hookform/resolvers` | 7.87.0 / 5.9.1 | zod 4 resolver                                                                          |
| `axllent/mailpit` (docker)                | v1.31          | SMTP 1025, UI 8025 (both free on the dev machine)                                       |

## Step 1 — Schema (⚠ schema change → ADR lines)

- `packages/database/prisma/schema.prisma`
  - Better Auth models generated with `npx @better-auth/cli@latest generate`, then merged by hand:
    `@@map` to snake_case tables (`users`, `sessions`, `accounts`, `verifications`), UUID v7 ids
    where Better Auth allows custom ids (verify: BA generates ids itself; keep `String @id`).
  - `User` additional fields: `employeeCode String?`, `department String?`,
    `role String @default("member")` (Better Auth stores roles as strings; the allowed set
    `admin | hr_manager | dept_head | member` lives in `@repo/validation` `roleSchema`),
    `deletedAt DateTime?` (soft delete).
  - `OutboxEmail { id, to, template, payload Json, status OutboxStatus (PENDING|SENT|FAILED),
attempts Int, sentAt?, lastError?, createdAt }` + index on `(status, createdAt)`.
- Migration `phase1_auth_outbox` (created with `yarn db:migrate:dev --name phase1_auth_outbox`).
- `docs/adr/0002-auth.md`, `docs/adr/0004-outbox.md` (created in this step, filled in Step 7).

## Step 2 — `packages/auth`

- `package.json` (`better-auth`), `src/access-control.ts` (`createAccessControl` statements +
  the four roles — API confirmed against current docs before coding, no `roles: []` guessing),
  `src/server.ts` (`betterAuth({...})`: `prismaAdapter(prisma, { provider: "postgresql" })`,
  `emailAndPassword` with `requireEmailVerification`, `emailVerification.sendVerificationEmail`
  delegating to a `sendMail` callback injected by the API (outbox, never inline), `session`
  7d / `updateAge` 1d, `user.additionalFields`, `plugins: [admin({ ac, roles })]`,
  `trustedOrigins: [WEB_ORIGIN]`, cookie options documented for same-parent-domain deploys),
  `src/client.ts` (`createAuthClient` + `adminClient`, React), `src/index.ts`.
- Env additions in `.env.example`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MAIL_SMTP_URL`,
  `MAIL_FROM`.
- Tests: role table present; integration (testcontainers): sign-up creates `users` + `accounts`
  rows and invokes the mail callback exactly once.

## Step 3 — `packages/permissions`

- `src/ability.ts`: `defineAbilityFor(user)` with `createPrismaAbility`; actions
  `manage | create | read | update | delete | changeRole`; subjects `User | all`.
  Rules: admin manage all; hr_manager read all users + update users in own department;
  everyone read/update self. Exports `AppAbility`, `subject` helper, `accessibleBy` re-export.
- `src/react.tsx`: `AbilityProvider`, `Can`, `useAbility` (`@casl/react`).
- `src/ability.test.ts`: the matrix spec — role × action × (self | other | same-dept |
  other-dept), commented as the permission spec.

## Step 4 — `apps/api`

- `src/core/context.ts`: resolve the session (`auth.api.getSession({ headers })`), build
  `ability`; `AuthUser` becomes Better Auth's user type + `role`, `department`.
- `src/trpc/init.ts`: `protectedProcedure` exposes typed `user` + `ability`;
  `src/trpc/middleware/require-ability.ts`: `requireAbility(action, subject)`.
- `src/app.ts`: mount `auth.handler` at `/api/auth/*` (CORS with credentials for it too);
  `src/middleware/rate-limit.ts` (`RateLimiterRedis`, 10 attempts / minute / IP on
  `/api/auth/sign-in/*`, 429 with `Retry-After`).
- `src/modules/email/email.service.ts`: `enqueueEmail(deps, { to, template, payload }, tx?)` →
  insert `OutboxEmail` inside the caller's transaction when given → `afterCommit` enqueue with
  `jobIdFor("email", row.id)`; `src/modules/email/templates.ts`.
- User module (reference implementation of `.claude/rules/module-template.md`):
  `packages/validation/src/user.schema.ts`, `packages/database/src/repositories/user.repository.ts`
  (+ `outbox-email.repository.ts`), `src/modules/user/user.service.ts` (getById, list with
  `accessibleBy`, updateProfile, changeRole with last-admin `ConflictError`, deactivate = soft
  delete + revoke sessions via BA admin API), `src/trpc/routers/user.router.ts` (me, byId, list,
  updateProfile, changeRole, deactivate) — each: zod input → ability → service.
- Tests: service unit tests with testcontainers Postgres; router tests through `createCaller`;
  HTTP test for rate limiting.

## Step 5 — `packages/queue` + `apps/worker`

- `packages/queue/src/names.ts`: `QUEUE_NAMES.email`; `src/jobs/email.job.ts`:
  `EmailJob = { outboxEmailId: string; traceId?: string }`, `createEmailQueue(connection)`.
- `apps/worker/src/mail/mail-provider.ts` (interface), `smtp-mail-provider.ts` (nodemailer →
  Mailpit), `memory-mail-provider.ts` (tests).
- `apps/worker/src/processors/email.processor.ts`: load row → no-op if `SENT` → send → mark
  `SENT`; on the final attempt mark `FAILED` + `lastError` (`UnrecoverableError` for permanent
  failures); concurrency 5, limiter 20/s.
- `apps/worker/src/schedulers/outbox-sweeper.ts`: BullMQ 6 job scheduler
  (`queue.upsertJobScheduler("outbox-sweeper", { every: 120_000 })`) re-enqueueing `PENDING`
  rows older than 1 minute with deterministic ids.
- `docker-compose.yml`: `mailpit` service (SMTP 1025, UI 8025); `.env.example`.
- Tests (testcontainers Postgres + Redis): rollback → no row, no job; duplicate jobId no-op;
  worker idempotency; sweeper recovers a `PENDING` row after `FLUSHALL`.

## Step 6 — `apps/web`

- `proxy.ts` (Next 16 replacement for middleware) redirecting unauthenticated users from
  `/dashboard`, `/users`, `/profile`; server-side session in the `(app)` layout.
- Routes: `app/(auth)/login`, `register`, `verify-email`; `app/(app)/dashboard`, `users`
  (pagination + search, admin & hr_manager), `users/[id]` (edit / change role), `profile`.
- `lib/auth/client.ts`, `lib/auth/server.ts`, `components/ability-provider.tsx`; forms with
  react-hook-form + `zodResolver` and schemas from `@repo/validation`.
- shadcn components added via CLI from `apps/web`: `input`, `label`, `card`, `field`, `badge`,
  `table`, `select`, `dropdown-menu`, `skeleton`, `sonner`.
- `packages/ui/src/components/composed/status-badge.tsx` (role badge variant).

## Step 7 — docs

- `docs/adr/0002-auth.md`, `0003-permissions.md` (two-layer authz), `0004-outbox.md`.
- `.claude/rules/module-template.md` updated with the real user-module file paths;
  `docs/conventions.md` "Failed jobs and manual retry" filled with the implemented semantics;
  README "How to add a new module" walkthrough.

## Definition of done (§F)

register → verification email visible in Mailpit (via the worker) → login → dashboard; admin can
list/edit/change roles; member sees only self and gets FORBIDDEN otherwise; ability matrix test
green; kill the worker during registration → restart → email delivered exactly once;
`yarn verify` + CI green.

## Risks and questions for the human

1. **Better Auth admin plugin API** (1.7.x) — roles via `createAccessControl` statements; the
   exact option names are confirmed from the installed package types before coding.
2. **`role` column type** — Better Auth writes strings; proposal: `String @default("member")`
   in Prisma + `roleSchema` enum in `@repo/validation` (no Prisma enum), so BA and our code agree.
3. **`department`** — free-text string in Phase 1 (hr_manager scope = equality); a `Department`
   table is a later phase.
4. **Production mail provider** — Phase 1 ships SMTP (Mailpit) only; the `MailProvider`
   interface is the extension point.
5. **Size** — ~45 files; protocol.md caps an MR at 15 files. Proposed split into four MRs:
   (1) schema + `packages/auth` + `packages/permissions`; (2) API wiring + user module;
   (3) queue/worker/outbox + Mailpit; (4) web pages + docs.

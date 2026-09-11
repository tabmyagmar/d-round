# d-round — form templates & approval workflows

## What

d-round is a form-template and approval-workflow system: templates → routes → submissions →
multi-step approval. This repository currently contains:

- **Phase 0 — foundation**: a Turborepo monorepo with the API (Hono + tRPC), worker (BullMQ) and
  web (Next.js 16) apps, the shared packages, Docker services, testing with testcontainers, CI and
  the agent-orchestration files. Health check end to end.
- **Phase 1 — auth, users, permissions, outbox email**: email + password sign-up with verified
  emails (Better Auth), 7-day cookie sessions, four roles, a user module (profile, list, change
  role, deactivate) behind two-layer authorization (CASL + service rules), and the first real
  background job: verification emails written to a transactional outbox, delivered by the worker
  through SMTP (Mailpit in development) with retries and a sweeper.

Templates, routes and approvals come in later phases.

## Prerequisites

- **Node 24** — the version is in `.nvmrc` (`nvm use` / `fnm use`).
- **Yarn 4** via Corepack: `corepack enable` (the version comes from
  `package.json#packageManager`).
- **Docker Desktop** — for Postgres, Redis, Mailpit and pgAdmin, and for the testcontainers the
  tests use.
- Apple Silicon: `postgis/postgis` is amd64-only and runs under Rosetta. For native speed add
  `POSTGRES_IMAGE=imresamu/postgis:18-3.6` and `POSTGRES_PLATFORM=linux/arm64` to `.env` (see
  `docs/conventions.md`).

## Quick start

```sh
cp .env.example .env   # one root .env for the whole monorepo
yarn                   # installs, runs prisma generate, installs the husky hooks
yarn docker:up         # postgres + pgadmin + redis + mailpit, waits for the healthchecks
yarn db:migrate        # prisma migrate deploy
yarn db:seed           # five verified test accounts, password A123456 (idempotent)
yarn dev               # web + api + worker (all three; emails need the worker)
```

Then sign in at http://localhost:3000/login as `admin@test.com` / `A123456` (or `hr@test.com`,
`head@test.com`, `member@test.com`, `guest@test.com` — same password, roles `hr_manager`,
`dept_head`, `member`, `member` without department). Or:

| Service      | URL                            | Notes                                                     |
| ------------ | ------------------------------ | --------------------------------------------------------- |
| Web          | http://localhost:3000          | `/login`, `/register`, `/dashboard`, `/users`, `/profile` |
| API          | http://localhost:4000/health   | Postgres and Redis probes; 200 `ok` / 503 `degraded`      |
| Auth         | http://localhost:4000/api/auth | Better Auth endpoints (used by the web app)               |
| Mailpit      | http://localhost:8025          | every outbox email lands here (SMTP on port 1025)         |
| pgAdmin      | http://localhost:5050          | login `admin@example.com` / `admin` (from `.env`)         |
| RedisInsight | http://localhost:5540          | optional: `docker compose --profile tools up -d`          |

### Environment variables

`.env.example` documents every variable; the ones added in Phase 1:

| Variable              | Used by | Meaning                                                                                                  |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`  | api     | signs sessions and tokens (`openssl rand -base64 32`, at least 32 chars); rotating it signs everyone out |
| `API_URL`             | api     | public origin of the API; Better Auth sets its cookies for this host (default `http://localhost:4000`)   |
| `WEB_ORIGIN`          | api     | browser origin allowed with credentials (CORS, `trustedOrigins`; default `http://localhost:3000`)        |
| `COOKIE_DOMAIN`       | api     | optional; production parent domain shared by web and api (see `docs/adr/0002-auth.md`)                   |
| `MAIL_SMTP_URL`       | worker  | SMTP endpoint, `smtp://localhost:1025` for Mailpit                                                       |
| `MAIL_FROM`           | worker  | sender, e.g. `d-round <no-reply@d-round.local>`                                                          |
| `NEXT_PUBLIC_API_URL` | web     | API origin the browser and the server components call                                                    |

## Phase 1 walkthrough

1. Run `yarn dev` — the worker must be running, otherwise the outbox rows stay `PENDING` and no
   mail is delivered.
2. Open http://localhost:3000/register and create an account (name, email, password; employee
   code and department are optional). You are redirected to `/verify-email`.
3. Open Mailpit at http://localhost:8025: the verification mail is there (API wrote an
   `outbox_emails` row and enqueued the job after commit; the worker rendered and sent it).
4. Click the link. Better Auth verifies the email, signs you in and redirects to `/dashboard`.
   Signing in before verification is refused with a "resend the verification email" hint.
5. Every self-registered account starts as `member`. Sign in as the seeded `admin@test.com` /
   `A123456` (`yarn db:seed`) to get the `Users` navigation entry; from `/users` an admin can
   search, filter by role, edit profiles, change roles (the last active admin cannot be demoted)
   and deactivate users (soft delete + all sessions revoked). Without the seed, promote an account
   directly in the database and sign in again:

   ```sh
   docker compose exec postgres psql -U postgres -d workflow -c "update users set role='admin' where email='<you>'"
   ```

### Roles

| Role         | May read              | May update            | Change roles / deactivate |
| ------------ | --------------------- | --------------------- | ------------------------- |
| `admin`      | every user            | every user            | yes                       |
| `hr_manager` | every user            | self + own department | no                        |
| `dept_head`  | self + own department | self                  | no                        |
| `member`     | self                  | self                  | no                        |

The rules live in `packages/permissions/src/rules.ts`; the matrix test
`packages/permissions/test/ability.test.ts` is the spec; the API re-checks every request (the UI
only hides what you may not do). Details: `.claude/rules/permissions.md`,
`docs/adr/0003-permissions.md`.

## Scripts (root)

| Script                | What it does                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `yarn dev`            | `turbo run dev` — web (`next dev`), api and worker (`tsx watch`); all three are needed for the full flow |
| `yarn build`          | `turbo run build` — Next build plus `tsdown` bundles for api/worker                                      |
| `yarn verify`         | lint + typecheck + test + build + format:check (the CI gate)                                             |
| `yarn lint`           | ESLint in every workspace                                                                                |
| `yarn typecheck`      | `tsc --noEmit` in every workspace                                                                        |
| `yarn test`           | `vitest run` in every workspace (testcontainers need Docker)                                             |
| `yarn format`         | `prettier --write .`                                                                                     |
| `yarn format:check`   | `prettier --check .`                                                                                     |
| `yarn db:generate`    | `prisma generate` (also runs on `postinstall`)                                                           |
| `yarn db:migrate`     | `prisma migrate deploy` — apply the committed migrations                                                 |
| `yarn db:migrate:dev` | `prisma migrate dev` — create a migration locally (needs `docker:up`)                                    |
| `yarn db:studio`      | Prisma Studio                                                                                            |
| `yarn db:seed`        | `prisma db seed` → `prisma/seed.ts`: upserts the five `*@test.com` accounts (password `A123456`)         |
| `yarn docker:up`      | `docker compose up -d --wait`                                                                            |
| `yarn docker:down`    | `docker compose down` (volumes are kept)                                                                 |
| `yarn docker:logs`    | `docker compose logs -f`                                                                                 |

## Folder map

```text
apps/
  api/        Hono + tRPC server. src/core (context with session + ability, errors, error-mapping),
              src/trpc (transport: init with requireAbility, routers/), src/modules (user, email,
              health services), src/middleware (rate limit, request logger), src/health, src/lib,
              test/ (mirrors src/: test/modules, test/trpc, test/core; HTTP + auth integration
              tests at the root, support.ts harness, global-setup.ts)
  worker/     BullMQ worker process. src/processors/email.processor.ts, src/schedulers/
              outbox-sweeper.ts, src/mail (MailProvider, SMTP, memory, templates), test/ (mirrors
              src/, support.ts)
  web/        Next.js 16 App Router, Tailwind v4, tRPC + React Query client. proxy.ts,
              app/(auth) (login, register, verify-email), app/(app) (dashboard, users, profile),
              features/auth (login-form, register-form, resend-verification), features/users
              (users-table, user-editor, profile-form, profile-editor, role-badge),
              components/ (app-shell, theme-provider), lib/auth, lib/trpc
packages/
  auth/       Better Auth: createAuth (server), createAuthReactClient (browser), admin-plugin
              access control, auth-cli.config.ts for `npx auth generate`
  permissions/ CASL: rules.ts (defined once), ability.ts (browser), server.ts (Prisma, list
              filtering), react.tsx (AbilityProvider, Can, useAbility), test/ability.test.ts (the
              spec)
  database/   Prisma 7 multi-file schema (prisma/schema: schema.prisma + system/, auth/, email/),
              migrations, seed.ts (test accounts), generated client (git-ignored), repositories
              (user, outbox-email), utils (pagination, errors, transaction), test/ (testcontainers
              helper, test/repositories, test/utils)
  validation/ zod re-export, shared schemas (user.schema.ts: roles, sign-up/in, profile, list),
              createEnv() for env validation
  queue/      BullMQ + ioredis wrapper: connection, createQueue, createWorker, pub/sub, jobIdFor,
              QUEUE_NAMES, jobs/email.job.ts (EmailJob contract), test/ (testcontainers Redis)
  logger/     pino with redaction, createLogger / childLogger
  ui/         shadcn primitives (src/components), react-hook-form fields (src/components/form:
              TextField, PasswordField, TextareaField, SelectField, CheckboxField, RadioField),
              composed components (src/components/composed: StatusBadge, DataTable, ConfirmDialog),
              theme tokens (src/styles/globals.css)
  eslint-config/      ESLint 10 presets: base, node, react, next + boundaries.js (layer rules)
  typescript-config/  tsconfig presets: base, node, nextjs, react-library
docs/
  conventions.md      why every rule exists
  adr/                architecture decision records
.claude/
  agents/             planner, implementer, reviewer, verifier subagents
  rules/              path-scoped rules (auto-loaded by Claude Code)
  skills/             how-to guides per library
  settings.json       allowed and denied commands for agents
CLAUDE.md, AGENTS.md, protocol.md   agent entry points (see below)
```

## Layers

```text
                  apps/web (Next.js) --- tRPC over HTTP, imports the AppRouter type only
                          |
                          v
  +---------------------------------------------------------------+
  | apps/api                                                      |
  |   transport   src/trpc  (graphql/, rest/ later)               |
  |       |       zod input -> ability check -> service call      |
  |       v                                                       |
  |   service     src/modules/<name>/<name>.service.ts            |
  |       |       business rules, transactions, domain errors     |
  +-------|-------------------------------------------------------+
          v
      repository   packages/database/src/repositories   <---- apps/worker (BullMQ consumers)
          |        pure data access, Prisma types                    ^
          v                                                          | jobs: IDs only,
        prisma  -> PostgreSQL                          Redis <-------+ enqueued after commit
```

The direction is enforced by ESLint (`boundaries/dependencies`): a service importing from `trpc/`
fails `yarn lint`. Details and rationale: `docs/conventions.md`, `.claude/rules/layers.md`.

## How to add a new module

Follow `.claude/rules/module-template.md`: four files (`<name>.schema.ts` in
`packages/validation`, `<name>.repository.ts` in `packages/database`, `<name>.service.ts` in
`apps/api/src/modules/<name>`, `<name>.router.ts` in `apps/api/src/trpc/routers`), tests under each
workspace's `test/` folder mirroring `src/`, and the router registered in
`apps/api/src/trpc/router.ts`. The user module is the reference
implementation — read these four files first:

- `packages/validation/src/user.schema.ts` — zod schemas shared with the web forms
- `packages/database/src/repositories/user.repository.ts` — pure data access
- `apps/api/src/modules/user/user.service.ts` — row-level ability checks, last-admin rule,
  `withTransaction`, `ConflictError` from unique violations, session revocation
- `apps/api/src/trpc/routers/user.router.ts` — `protectedProcedure.use(requireAbility(...))` →
  `input(schema)` → one service call

and their tests (`packages/database/test/repositories/user.repository.test.ts`,
`apps/api/test/modules/user/user.service.test.ts`,
`apps/api/test/trpc/routers/user.router.test.ts`), which use the harness in
`apps/api/test/support.ts` (`createHarness`, `signedInUser`, `contextFor`).

## Working with AI agents

- `CLAUDE.md` — the single source of truth for agents (architecture, working rules, style).
  `AGENTS.md` points to it for other tools.
- `protocol.md` — the planner → implementer → verifier → reviewer flow, limits and guardrails.
- `.claude/agents/` — the four subagents; `.claude/rules/` — path-scoped rules loaded
  automatically; `.claude/skills/` — library how-tos; `.claude/settings.json` — command allow and
  deny lists (no destructive git or database commands, no reading `.env`).
- AI-assisted commits carry the attribution trailer described in
  `docs/conventions.md#ai-attribution`.

## Documentation

- `docs/conventions.md` — layer contract, lint rule rationale, commits, environment,
  authentication and sessions, testing, IDs, errors, queue semantics, failed jobs, Docker notes,
  versions policy.
- `docs/adr/` — architecture decision records: `0001-stack.md`, `0002-auth.md` (Better Auth),
  `0003-permissions.md` (two-layer authorization), `0004-outbox.md` (transactional outbox).
- `docs/plans/phase-1-plan.md` — the Phase 1 plan with its deviations.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: Postgres
(`postgis/postgis:18-3.6`) and Redis (`redis:8-alpine`) service containers → Node from `.nvmrc`
→ Corepack → Yarn and Turborepo caches → `yarn install --immutable` (runs `prisma generate`) →
`yarn db:migrate` → schema-drift check
(`prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`) →
`yarn verify` → commitlint on the pull request's commits.

# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Built from the Turborepo monorepo template: a Hono + tRPC API, a BullMQ worker and a Next.js 16 app
on top of Prisma 7 / PostgreSQL, Redis, Better Auth and CASL, with Docker services, testcontainers,
CI and the Claude Code orchestration files already wired. Auth (admin-created users, verified email,
sessions), a `user` reference module (list, profile, catalog roles, deactivate) and a transactional
email outbox are included so a new project starts from a working vertical slice instead of an empty
shell.

## New project from this template

```sh
# 0. Prerequisites: Node 24 (.nvmrc), Corepack, Docker Desktop
gh repo create my-app --template <org>/<this-repo> --private --clone   # or clone + `rm -rf .git && git init`
cd my-app
nvm use && corepack enable

# 1. Rename: rewrites every text placeholder and the identifier defaults (see scripts/init-template.mjs)
node scripts/init-template.mjs --name "My App" --db my_app --lang en \
  --description "What the app does" --mail-from "My App <no-reply@my-app.local>"
yarn                                       # refreshes yarn.lock for the new package name
git rm scripts/init-template.mjs scripts/init-template.test.mjs   # test:scripts then finds nothing and passes

# 2. Environment
cp .env.example .env                       # one root .env for the whole monorepo
#    BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#    change POSTGRES_PORT / REDIS_PORT if 5433 / 6380 clash (keep DATABASE_URL / REDIS_URL in sync)

# 3. Infrastructure, database, run
yarn docker:up                             # postgres, redis, mailpit, pgadmin — waits for health checks
yarn db:migrate                            # applies the committed migrations
yarn db:seed                               # reference data + one test account per role (A12345678)
yarn dev                                   # web :3000, api :4000, worker; Mailpit UI :8025

# 4. Gate and first commit (Conventional Commits, enforced by the commit-msg hook)
yarn verify
git add -A && git commit -m "chore: bootstrap from template"
git push -u origin main                    # CI: migrations, schema drift, verify, commitlint
```

Then follow `.claude/rules/module-template.md` for the first feature module. Mark the source
repository as a _template repository_ in its GitHub settings so `gh repo create --template` works.
Delete `TEMPLATE_AUDIT.md` once you no longer need the history of this template pass.

## Prerequisites

- **Node 24** — the version is in `.nvmrc` (`nvm use` / `fnm use`).
- **Yarn 4** via Corepack: `corepack enable` (the version comes from `package.json#packageManager`).
- **Docker Desktop** — for Postgres, Redis, Mailpit and pgAdmin, and for the testcontainers the
  tests use.

## Quick start (existing checkout)

```sh
cp .env.example .env   # one root .env for the whole monorepo
yarn                   # installs, runs prisma generate, installs the husky hooks
yarn docker:up         # postgres + pgadmin + redis + mailpit, waits for the healthchecks
yarn db:migrate        # prisma migrate deploy
yarn db:seed           # reference data + four verified test accounts, password A12345678 (re-runnable)
yarn dev               # web + api + worker (all three; emails need the worker)
```

Then sign in at http://localhost:3000/login as `admin@test.com` / `A12345678` (or
`super_admin@test.com`, `manager@test.com`, `am@test.com`, same password). Or:

| Service      | URL                            | Notes                                                |
| ------------ | ------------------------------ | ---------------------------------------------------- |
| Web          | http://localhost:3000          | `/login`, `/admin/workflow` (sidebar shell, landing) |
| API          | http://localhost:4000/health   | Postgres and Redis probes; 200 `ok` / 503 `degraded` |
| Auth         | http://localhost:4000/api/auth | Better Auth endpoints (used by the web app)          |
| Mailpit      | http://localhost:8025          | every outbox email lands here (SMTP on port 1025)    |
| pgAdmin      | http://localhost:5050          | login `admin@example.com` / `admin` (from `.env`)    |
| RedisInsight | http://localhost:5540          | optional: `docker compose --profile tools up -d`     |

### Environment variables

`.env.example` documents every variable. Each app validates its own subset once at startup with zod
(`apps/api/src/env.ts`, `apps/worker/src/env.ts`, `apps/web/lib/env.ts`) and refuses to start on a
missing or malformed value.

| Variable              | Used by    | Meaning                                                                                                  |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | all        | Postgres connection string (`POSTGRES_*` feed docker-compose; keep them in sync)                         |
| `REDIS_URL`           | api/worker | Redis connection string                                                                                  |
| `BETTER_AUTH_SECRET`  | api        | signs sessions and tokens (`openssl rand -base64 32`, at least 32 chars); rotating it signs everyone out |
| `API_URL`             | api        | public origin of the API; Better Auth sets its cookies for this host (default `http://localhost:4000`)   |
| `WEB_ORIGIN`          | api        | browser origin allowed with credentials (CORS, `trustedOrigins`; default `http://localhost:3000`)        |
| `COOKIE_DOMAIN`       | api        | optional; production parent domain shared by web and api (see `docs/adr/0002-auth.md`)                   |
| `MAIL_SMTP_URL`       | worker     | SMTP endpoint, `smtp://localhost:1025` for Mailpit                                                       |
| `MAIL_FROM`           | worker     | sender, e.g. `My App <no-reply@example.com>`; the display name is the brand used in emails               |
| `NEXT_PUBLIC_API_URL` | web        | API origin the browser and the server components call (must be http(s))                                  |
| `POSTGRES_IMAGE`      | docker     | Postgres image for compose (default `postgres:18-alpine`; `TEST_POSTGRES_IMAGE` for tests)               |

The web app's name, description, `<html lang>`, logo (`apps/web/public/logo.png`, shown in the
sidebar and on the auth card) and auth background (`apps/web/public/auth-background.webp`) live in
`apps/web/lib/brand.ts`.

The 操作方法 page links guide books under `apps/web/public/help/` (`guidebook.pdf`, list in
`apps/web/features/help/utils/help-guides.ts`). They are too large for git and are ignored: a
deployment places them, and a developer copies them from the legacy d-round-web checkout
(`public/help/ガイドブック.pdf`).

## What is included

- **Auth** (`packages/auth`, Better Auth; how it behaves at runtime: `docs/auth.md`): email +
  password sign-in (7-day cookie sessions,「ログイン状態を保持する」), no public sign-up, roles
  `super_admin | admin | manager | am`. Users are invited (`user.invite`: an account without a
  password plus an invitation mail whose link sets the first password), reset a forgotten password
  from `/forgot-password`, and change it on `/admin/profile`; an admin can re-send the mail from the
  user page. One password policy for forms and API, Japanese mails through the outbox (Mailpit at
  `localhost:8025` in development). Seeded test accounts: `yarn db:seed`.
- **User module** (the reference module):
  `user.me / byId / list / updateProfile / update / deactivate / reactivate / invite / sendPasswordReset / employeeNumberAvailable / chargerOptions`
  and `permission.catalog` behind two-layer authorization — CASL abilities built from the catalog
  grants in the session (`packages/permissions`; spec: `packages/permissions/test/ability.test.ts`
  and `apps/api/test/permission-catalog.test.ts`) plus stateful service rules (the last active admin
  cannot be demoted or deactivated; deactivation soft-deletes the user and deletes its sessions in
  one transaction). A 担当者 has a
  profile: 社員番号, 部署名, 役職, エリア and 地域 (`docs/adr/0007-user-profiles.md`). Web:
  `/admin/master/user`, `/admin/master/user/[id]`, `/admin/profile`.
- **Staff module** (`docs/adr/0008-staff.md`):
  `staff.list / byId / create / update / changeStatus / deleteMany / employeeNumberAvailable / byCharger`,
  and `source.regions / prefectures / addressByPostCode` for the reference data. A staff
  has 担当者 (users covering its regions, with history), an address checked against the post-code
  master, family members, memos and employment periods; スタッフ削除 soft-deletes a 停止 staff. Web:
  `/admin/staff`, `/admin/staff/[id]`, the three-step form on `/admin/staff/create` and
  `/admin/staff/update/[id]`, and the user detail's 担当スタッフ.
- **Client module** (`docs/adr/0011-clients-and-branches.md`):
  `client.list / byId / create / update / changeStatus / deleteMany / numberAvailable / options`. A
  client has エリア, 地域, 受注区分, 担当者 and an address checked against the post-code
  master; クライアント削除 soft-deletes a 停止 client and frees its number. Web: `/admin/client`,
  `/admin/client/[id]`, the two-step form on `/admin/client/create` and `/admin/client/update/[id]`.
- **Web shell**: a shadcn sidebar under `/admin` with every page of the legacy d-round-web app
  (workflow, templates, users, audit log, clients, branches, staff, settings), most of them
  placeholders; `/admin/workflow` is the landing page. One route catalog
  (`apps/web/config/routes.ts`) holds each page's path, title and required permission; the sidebar
  and a server-side page guard decide with the same rule, from the session's grants
  (`.claude/rules/permissions.md`, Web).
- **Transactional outbox** (`docs/adr/0004-outbox.md`): the API writes an `outbox_emails` row inside
  the transaction and enqueues an ID-only BullMQ job after commit; the worker renders and sends
  through SMTP (Mailpit locally) with retries, and a sweeper re-enqueues stale rows.
- **Health**: `GET /health` (Postgres + Redis probes) and tRPC `health.ping`; ordered graceful
  shutdown in api and worker; pino logging with redaction and request ids.

Who may do what (roles, actions, subjects) is data in
`packages/database/prisma/seed/data/permissions.csv`; `.claude/rules/permissions.md` explains the
model and how a role is added.

## Scripts (root)

| Script                | What it does                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn dev`            | `turbo run dev` — web (`next dev`), api and worker (`tsx watch`); all three are needed for the full flow                             |
| `yarn build`          | `turbo run build` — Next build plus `tsdown` bundles for api/worker                                                                  |
| `yarn verify`         | lint + typecheck + test + test:scripts + build + format:check (the CI gate)                                                          |
| `yarn lint`           | ESLint in every workspace                                                                                                            |
| `yarn typecheck`      | `tsc --noEmit` in every workspace                                                                                                    |
| `yarn test`           | `vitest run` in every workspace (testcontainers need Docker; web/ui run in jsdom)                                                    |
| `yarn test:scripts`   | node:test suite for `scripts/` (the template initialiser)                                                                            |
| `yarn format`         | `prettier --write .`                                                                                                                 |
| `yarn format:check`   | `prettier --check .`                                                                                                                 |
| `yarn db:generate`    | `prisma generate` (also runs on `postinstall`)                                                                                       |
| `yarn db:migrate`     | `prisma migrate deploy` — apply the committed migrations                                                                             |
| `yarn db:migrate:dev` | `prisma migrate dev` — create a migration locally (needs `docker:up`)                                                                |
| `yarn db:studio`      | Prisma Studio                                                                                                                        |
| `yarn db:seed`        | `prisma db seed` → `prisma/seed/index.ts`: reference data, then the four test accounts (only when `NODE_ENV` is development or test) |
| `yarn docker:up`      | `docker compose up -d --wait`                                                                                                        |
| `yarn docker:down`    | `docker compose down` (volumes are kept)                                                                                             |
| `yarn docker:logs`    | `docker compose logs -f`                                                                                                             |

## Folder map

```text
apps/
  api/        Hono + tRPC server. src/core (context with session + ability, errors, error-mapping),
              src/trpc (transport: init with requireAbility, routers/), src/modules (user, source,
              staff, comment-template, permission, email, health services), src/middleware (rate limit,
              request logger), src/health, src/lib,
              test/ (mirrors src/: test/modules, test/trpc, test/core; HTTP + auth integration
              tests at the root, support.ts harness, global-setup.ts)
  worker/     BullMQ worker process. src/processors/email.processor.ts, src/schedulers/
              outbox-sweeper.ts, src/mail (MailProvider, SMTP, memory, templates, mail-from),
              test/ (mirrors src/, support.ts)
  web/        Next.js 16 App Router, Tailwind v4, tRPC + React Query client. proxy.ts,
              app/(auth) (login, forgot-password, new-password), app/admin (sidebar
              layout, one page per route), config/ (routes.ts: the route catalog, nav.ts: the
              sidebar), features/auth (login-form, forgot-password-form, new-password-form,
              auth-errors), features/users (containers/, components/, hooks/, utils/, types.ts),
              features/staff and features/clients (the same shape), features/comment-templates,
              features/help,
              hooks/ (search-params, use-search, use-table-state), stores/ (row-selection),
              components/ (layout/: app-shell, app-sidebar, nav-main, app-header, page-title, user-menu;
              source/: エリア → 地域 → 都道府県 fields, filter fields and useSourceHierarchy, shared by
              the features; general-status-badge, page-guard, access-denied, placeholder-page,
              theme-provider), lib/auth (client, server, route-access), lib/trpc, lib/env, lib/brand,
              lib/position-labels, lib/general-status-labels,
              test/ (vitest + Testing Library, jsdom per file)
packages/
  auth/       Better Auth: createAuth (server), createAuthReactClient (browser), admin-plugin
              access control, auth-cli.config.ts for `npx auth generate`
  permissions/ CASL: rules.ts (defined once), ability.ts (browser), server.ts (Prisma, list
              filtering), react.tsx (AbilityProvider, Can, useAbility), test/ability.test.ts (the
              spec)
  database/   Prisma 7 multi-file schema (prisma/schema, one folder per module), migrations/ (the
              table is in .claude/rules/migrations.md), seed/ (reference data + dev test accounts),
              generated client (git-ignored), repositories/, utils (pagination, errors,
              transaction), test/ (testcontainers helper, test/repositories, test/utils, test/seed)
  validation/ zod re-export, shared schemas (user.schema.ts: roles, sign-in, names, 担当者 profile,
              list; source.schema.ts: areas, region codes, post codes, the form address;
              staff.schema.ts: the staff form and list; client.schema.ts: statuses, 受注区分, the
              client form and list), createEnv() for env validation
  queue/      BullMQ + ioredis wrapper: connection, createQueue, createWorker, pub/sub, jobIdFor,
              QUEUE_NAMES, jobs/email.job.ts (EmailJob contract), test/ (testcontainers Redis)
  logger/     pino with redaction, createLogger / childLogger
  dayjs/      dayjs configured once (utc, timezone, customParseFormat, ja) and the calendar-day
              helpers toIsoDay / fromIsoDay / todayIsoDay (ADR 0009)
  ui/         shadcn primitives (src/components), react-hook-form fields (src/components/form:
              Text/Textarea/Password/Number, Select/Combobox/MultiSelect, Checkbox/Switch/
              CheckboxGroup/Radio, Date/DateTime/DateRange, File, Hidden/ReadOnly, Array +
              FormFieldShell/useFormField for custom ones),
              composed components (src/components/composed: StatusBadge, DataTable, ConfirmDialog,
              PageHeader, EmptyState, OptionSelect, MultiOptionSelect, CheckboxGroup, …), hooks
              (src/hooks: use-mobile, use-debounced-callback, use-stepper), lib (locale, calendar-locale),
              theme tokens (src/styles/globals.css), test/ (jsdom component tests)
  eslint-config/      ESLint 10 presets: base, node, react, next + boundaries.js (layer rules)
  typescript-config/  tsconfig presets: base, node, nextjs, react-library
scripts/
  init-template.mjs   one-shot placeholder rewrite for a new project (delete after use)
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

Follow `.claude/rules/module-template.md`: four files (`<name>.schema.ts` in `packages/validation`,
`<name>.repository.ts` in `packages/database`, `<name>.service.ts` in `apps/api/src/modules/<name>`,
`<name>.router.ts` in `apps/api/src/trpc/routers`), tests under each workspace's `test/` folder
mirroring `src/`, and the router registered in `apps/api/src/trpc/router.ts`. The user module is the
reference implementation — read these four files first:

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
- `.claude/agents/` — the four subagents; `.claude/rules/` — path-scoped rules loaded automatically
  (`docs.md` says which file owns each fact); `.claude/skills/` — library how-tos;
  `.claude/settings.json` — command allow and deny lists (no destructive git or database commands,
  no reading `.env`).
- AI-assisted commits carry the attribution trailer described in
  `docs/conventions.md#ai-attribution`; pull requests follow `.github/PULL_REQUEST_TEMPLATE.md`.

## Documentation

- `docs/conventions.md` — layer contract, lint rule rationale, commits, environment, authentication
  and sessions, testing, IDs, errors, queue semantics, failed jobs, Docker notes, versions policy.
- `docs/auth.md` — authentication at runtime: sign-in, session lifetime, what ends a session,
  several devices, password links, rate limits, known gaps.
- `docs/plans/` — the plan of each closed ticket (`plan.md` while the ticket is open).
- `docs/adr/` — architecture decision records: `0001-stack.md`, `0002-auth.md` (Better Auth),
  `0003-permissions.md` (two-layer authorization), `0004-outbox.md` (transactional outbox).

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, on pull requests and on demand
(`workflow_dispatch`): Postgres (`postgres:18-alpine`, overridable with the `CI_POSTGRES_IMAGE`
repository variable) and Redis (`redis:8-alpine`) service containers → Node from `.nvmrc` → Corepack
→ Yarn and Turborepo caches → `yarn install --immutable` (runs `prisma generate`) →
`yarn db:migrate` → schema-drift check
(`prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`) →
`yarn verify` → commitlint on the pull request's commits. Dependency updates come from Renovate
(`renovate.json`: grouped, exact pins, no major bumps without a PR review).

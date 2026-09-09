# d-round — form templates & approval workflows

## What

d-round is a form-template and approval-workflow system: templates → routes → submissions →
multi-step approval. This repository currently contains the **Phase 0 foundation**: a runnable,
empty-but-wired Turborepo monorepo with the API, worker and web apps, the shared packages, Docker
services, testing, CI and the agent-orchestration files. The only "feature" is a health check.

## Prerequisites

- **Node 24** — the version is in `.nvmrc` (`nvm use` / `fnm use`).
- **Yarn 4** via Corepack: `corepack enable` (the version comes from
  `package.json#packageManager`).
- **Docker Desktop** — for Postgres, Redis and pgAdmin, and for the testcontainers the tests use.
- Apple Silicon: `postgis/postgis` is amd64-only and runs under Rosetta. For native speed add
  `POSTGRES_IMAGE=imresamu/postgis:18-3.6` and `POSTGRES_PLATFORM=linux/arm64` to `.env` (see
  `docs/conventions.md`).

## Quick start

```sh
cp .env.example .env   # one root .env for the whole monorepo
yarn                   # installs, runs prisma generate, installs the husky hooks
yarn docker:up         # postgres + pgadmin + redis, waits for the healthchecks
yarn db:migrate        # prisma migrate deploy
yarn dev               # web + api + worker
```

Then:

| Service      | URL                          | Notes                                                |
| ------------ | ---------------------------- | ---------------------------------------------------- |
| Web          | http://localhost:3000        | shows the `health.ping` result from the API          |
| API          | http://localhost:4000/health | Postgres and Redis probes; 200 `ok` / 503 `degraded` |
| pgAdmin      | http://localhost:5050        | login `admin@example.com` / `admin` (from `.env`)    |
| RedisInsight | http://localhost:5540        | optional: `docker compose --profile tools up -d`     |

## Scripts (root)

| Script                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `yarn dev`            | `turbo run dev` — web (`next dev`), api and worker (`tsx watch`)      |
| `yarn build`          | `turbo run build` — Next build plus `tsdown` bundles for api/worker   |
| `yarn verify`         | lint + typecheck + test + build + format:check (the CI gate)          |
| `yarn lint`           | ESLint in every workspace                                             |
| `yarn typecheck`      | `tsc --noEmit` in every workspace                                     |
| `yarn test`           | `vitest run` in every workspace (testcontainers need Docker)          |
| `yarn format`         | `prettier --write .`                                                  |
| `yarn format:check`   | `prettier --check .`                                                  |
| `yarn db:generate`    | `prisma generate` (also runs on `postinstall`)                        |
| `yarn db:migrate`     | `prisma migrate deploy` — apply the committed migrations              |
| `yarn db:migrate:dev` | `prisma migrate dev` — create a migration locally (needs `docker:up`) |
| `yarn db:studio`      | Prisma Studio                                                         |
| `yarn db:seed`        | `prisma db seed` → `prisma/seed.ts` (placeholder)                     |
| `yarn docker:up`      | `docker compose up -d --wait`                                         |
| `yarn docker:down`    | `docker compose down` (volumes are kept)                              |
| `yarn docker:logs`    | `docker compose logs -f`                                              |

## Folder map

```text
apps/
  api/        Hono + tRPC server. src/core (context, errors, error-mapping), src/trpc (transport),
              src/modules (services), src/health, src/middleware, src/lib, test/ (integration)
  worker/     BullMQ worker process. src/processors/<queue>.processor.ts, graceful shutdown
  web/        Next.js 16 App Router, Tailwind v4, tRPC + React Query client
packages/
  database/   Prisma 7 schema + migrations, generated client (git-ignored), repositories, utils
              (pagination, errors, transaction), test/ (testcontainers Postgres helper)
  validation/ zod re-export, shared schemas, createEnv() for env validation
  queue/      BullMQ + ioredis wrapper: connection, createQueue, createWorker, pub/sub, jobIdFor,
              QUEUE_NAMES, test/ (testcontainers Redis helper)
  logger/     pino with redaction, createLogger / childLogger
  ui/         shadcn primitives (src/components), composed components (src/components/composed),
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
`apps/api/src/modules/<name>`, `<name>.router.ts` in `apps/api/src/trpc/routers`), tests next to
each, and the router registered in `apps/api/src/trpc/router.ts`. Phase 1's user module will be
the reference implementation.

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

- `docs/conventions.md` — layer contract, lint rule rationale, commits, environment, testing,
  IDs, errors, queue semantics, Docker notes, versions policy.
- `docs/adr/` — architecture decision records (`0001-stack.md` and onwards).

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: Postgres
(`postgis/postgis:18-3.6`) and Redis (`redis:8-alpine`) service containers → Node from `.nvmrc`
→ Corepack → Yarn and Turborepo caches → `yarn install --immutable` (runs `prisma generate`) →
`yarn db:migrate` → schema-drift check
(`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`) →
`yarn verify` → commitlint on the pull request's commits.

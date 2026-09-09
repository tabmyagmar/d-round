# Conventions — the why behind the rules

`CLAUDE.md` states the rules, the linter enforces most of them, and this document explains them
for humans. Rule of thumb: a rule that lives in a document drifts, a rule that lives in a tool
does not. Everything mechanical therefore lives in ESLint, Prettier, commitlint and CI, and this
file only says why.

## Layer contract

```text
                +-------------------------------------------------------------+
  apps/web      |  apps/api                                                   |
  (Next.js)     |                                                             |
     |  tRPC    |  transport   apps/api/src/trpc   (graphql/, rest/ later)     |
     +--------->|      |  zod input -> ability check -> service call           |
  types only    |      v                                                      |
  (AppRouter)   |  service     apps/api/src/modules/<name>/<name>.service.ts   |
                |      |  business rules, workflow checks, transactions        |
                |      |  domain errors (core/errors.ts) -> core/error-mapping |
                +------|------------------------------------------------------+
                       v
                repository   packages/database/src/repositories   <---- apps/worker
                       |     pure data access, Prisma types              (BullMQ consumers,
                       v                                                 idempotent)
                prisma       packages/database/src/client.ts                 ^
                       |                                                     | jobs: IDs only,
                       v                                                     | after commit
                   PostgreSQL                        Redis  <--- packages/queue
```

Allowed directions: transport → service → repository → prisma, each layer importing only itself,
the layer directly below and shared packages. Composition roots (`apps/api/src/index.ts`,
`app.ts`, `env.ts`, `middleware/`, `health/`, `lib/`) may import every layer because they wire
them together. `apps/worker` reuses repositories and packages, never `@repo/api`. `apps/web`
imports `@repo/api` types only.

Why:

- **Adding a transport must not touch business code.** GraphQL and REST arrive as sibling folders
  of `trpc/` that wrap the same `buildRequestContext` and the same services. That only works if
  services know nothing about HTTP, tRPC or Hono.
- **Errors stay meaningful.** Services throw `NotFoundError`, `ForbiddenError`, `ConflictError`,
  `ValidationError`; each transport maps them once (`core/error-mapping.ts`). A service throwing
  `TRPCError` would tie every future transport to tRPC.
- **Repositories stay boring.** Pure data access is reused by the API, the worker and scripts,
  and is tested against a real database without any business context.
- **The rule is checked, not remembered.** `boundaries/dependencies` in
  `packages/eslint-config/boundaries.js` classifies every file into an element type and rejects
  imports in the wrong direction; a misplaced import fails `yarn lint`, the pre-commit hook and
  CI. The full matrix is in `.claude/rules/layers.md`.

## Lint rule groups

All rule groups live in `packages/eslint-config/base.js` (ESLint 10 flat config, type-aware via
`projectService`). Presets: `base` (framework-less packages), `node` (apps/api, apps/worker, Node
packages), `react` (packages/ui), `next` (apps/web). Each group in `base.js` starts with a short
WHY comment; the long form is here.

### Functions

`func-style: expression` and `prefer-arrow-callback` (no named function expressions). One
function shape everywhere: arrow functions have no `this`, no hoisting surprises, and read the
same in modules, callbacks and React components. Class methods are unaffected.

### Modules and imports

- `import-x/no-default-export` — named exports keep symbols greppable and refactor-safe (rename
  once, every import follows). Exempt: config files (`*.config.*`, `eslint.config.*`,
  `prisma.config.ts`, `postcss.config.*`) and Next.js framework files (`page`, `layout`, `route`,
  `proxy.ts`, `middleware.ts`, `instrumentation*.ts`, ...) because the tool, not us, decides.
- `import-x/no-duplicates` (`prefer-inline`) and `import-x/consistent-type-specifier-style`
  (`prefer-inline`) — one import statement per module, with `type` markers inline.
- `import-x/no-cycle` (`maxDepth: 4`) — cycles produce `undefined` at load time and hide layering
  mistakes.
- `import-x/order` — deterministic blocks: Node built-ins, third-party, `@repo/*` workspace
  packages, `@/` aliases, then relative paths (parent, sibling, index); alphabetised, one blank
  line between groups. Reviewers never spend time on import order and diffs stay small.
- `eslint-plugin-import-x` replaces `eslint-plugin-import`, which has no ESLint 10 support.

### Types

- `@typescript-eslint/no-explicit-any` — `any` switches the type checker off for everything it
  touches. Use `unknown` and narrow.
- `consistent-type-imports` and `consistent-type-exports` (inline `type` specifiers) — with
  `verbatimModuleSyntax` the compiler and bundlers must be able to erase type-only imports;
  marking them also documents runtime vs. type dependencies (the boundaries rule allows type-only
  imports across some boundaries for exactly this reason).
- `consistent-type-definitions: type` — one way to declare shapes; `type` composes with unions
  and mapped types without special cases.
- `no-unused-vars` with the `_` prefix escape — dead code is a smell; a deliberately unused
  parameter is marked, not silenced.
- `switch-exhaustiveness-check` — adding an enum value must break the build wherever the value
  is not handled.
- `restrict-template-expressions` (numbers and booleans allowed) — objects in template strings
  print `[object Object]`.
- `no-misused-promises` with `checksVoidReturn.attributes/arguments: false` — React props and
  event handlers legitimately receive async functions.
- Base presets: `strictTypeChecked` + `stylisticTypeChecked`. The TypeScript preset
  (`packages/typescript-config/base.json`) sets `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`,
  `noImplicitReturns` and `noFallthroughCasesInSwitch`.

### Logging

`no-console: error`. Console output has no level, no structure and no redaction, and is lost in
production. Everything goes through `@repo/logger` (pino), which redacts `password`, `token`,
`secret`, `authorization`, `cookie` and `set-cookie` paths once for every app. `packages/logger`
itself and the worker bootstrap opt out locally where no logger can exist yet.

### Naming

- `unicorn/filename-case: kebabCase` — kebab-case files with a role suffix (`user.service.ts`,
  `user.repository.ts`, `user.router.ts`, `user.schema.ts`, `email.processor.ts`) make the layer
  visible in the file name and greppable (`*.service.ts`). Dynamic route segments (`[id]`) are
  ignored; the `react` preset additionally allows `PascalCase.tsx` for components (shadcn
  generates kebab-case, both are fine).
- `unicorn/prefer-node-protocol` — `node:fs` is unambiguous for bundlers (`tsdown`) and readers.

### Environment

`turbo/no-undeclared-env-vars` (allow list: `NEXT_PUBLIC_*`, `TEST_*`, `NODE_ENV`, `CI`).
Turborepo runs tasks in strict env mode: a variable that is not declared in `turbo.json`
(`globalEnv`, a task's `env`, or `globalPassThroughEnv`) is not passed to the task and silently
disappears. The lint rule turns that into a lint error instead of a production surprise. Apps read
the environment exactly once through `createEnv(shape)` from `@repo/validation/env` (zod, fails
fast with a readable list of problems).

### Layer boundaries

`boundaries/dependencies` from `eslint-plugin-boundaries` 7, configured in
`packages/eslint-config/boundaries.js`: element types (`api-transport`, `api-service`, `api-core`,
`api-app`, `repository`, `database`, `worker`, `web`, `ui`, `shared`), `default: "disallow"`,
policies evaluated in order with the last match winning, and `@repo/*` imports matched by package
name so the rules do not depend on how workspace symlinks resolve. See "Layer contract" above and
`.claude/rules/layers.md` for the full matrix.

### Misc footguns

`eqeqeq: always` (no coercion surprises), `curly: all` (no dangling single-statement branches in
diffs), `no-param-reassign` (arguments are inputs), `object-shorthand`, `prefer-template` (no
string concatenation). `eslint-config-prettier` is applied last so no stylistic rule can disagree
with Prettier.

### Overrides

- Tests (`**/*.test.{ts,tsx}`, `**/test/**/*.ts`): `no-non-null-assertion`, `no-unsafe-*`,
  `no-empty-function`, `require-await` and `unbound-method` are off — tests assert behaviour, and
  a little type looseness keeps them readable. Everything else, including `no-console` and the
  boundaries, applies.
- Plain JavaScript files (`*.js`, `*.mjs`, `*.cjs`): the same function, import-order, naming and
  footgun rules without type information.
- React (`packages/eslint-config/react.js`): `@eslint-react/eslint-plugin`
  `recommended-type-checked` (replaces the unmaintained `eslint-plugin-react`) and
  `eslint-plugin-react-hooks`. Next (`next.js`): `@next/eslint-plugin-next` `core-web-vitals`
  plus the framework default-export exemptions.

## File naming

| Thing                 | Pattern                              | Example                              |
| --------------------- | ------------------------------------ | ------------------------------------ |
| Service               | `<name>.service.ts`                  | `user.service.ts`                    |
| Repository            | `<name>.repository.ts`               | `user.repository.ts`                 |
| tRPC router           | `<name>.router.ts`                   | `user.router.ts`                     |
| zod schemas           | `<name>.schema.ts`                   | `user.schema.ts`                     |
| Worker processor      | `<queue>.processor.ts`               | `email.processor.ts`                 |
| Test                  | `<file>.test.ts` next to the file    | `user.service.test.ts`               |
| React component       | `PascalCase.tsx` or `kebab-case.tsx` | `StatusBadge.tsx`, `button.tsx`      |
| Next.js special files | framework names                      | `page.tsx`, `layout.tsx`, `proxy.ts` |
| Config                | `<tool>.config.{ts,mjs}`             | `vitest.config.ts`                   |
| ADR                   | `NNNN-<kebab-title>.md`              | `0001-stack.md`                      |

One exported unit per file where practical; named exports only (see above).

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `build:`),
optionally scoped (`feat(api): ...`). Enforced by commitlint (`commitlint.config.mjs`, extends
`@commitlint/config-conventional`): body lines at most 100 characters, footer lines at most 200
(trailers may be long). Hooks via husky: `pre-commit` runs `lint-staged` (`eslint --fix
--max-warnings 0` and `prettier --write` on staged files), `commit-msg` runs `commitlint`. CI
re-checks every commit of a pull request with `commitlint --from <base> --to <head>`.

Why: the history is the changelog and the audit trail; a machine-readable format makes releases,
blame and bisecting cheap, and a hook is the only place where a rule is applied every time.

## AI attribution

AI-assisted commits carry a `Co-Authored-By` trailer naming the model, so the history shows which
changes were produced with an agent:

```text
feat(user): add changeRole with last-admin guard

Body lines wrap at 100 characters.

Co-Authored-By: Claude <model name> <noreply@anthropic.com>
```

For example: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

Pull request descriptions produced with an agent end with:

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

The trailer is the last block of the message (blank line before it); commitlint allows footer lines
up to 200 characters for this reason. Human-only commits carry no trailer.

## Environment variables

- One root `.env` (git-ignored) for the whole monorepo; `.env.example` is committed and documents
  every variable. Copy it once: `cp .env.example .env`.
- Apps load it with `dotenv` (`apps/api/src/env.ts`, `apps/worker/src/env.ts`: an app-local
  `.env` first, then `../../.env`), Prisma through `prisma.config.ts`. Real process env always
  wins over the file — CI and testcontainers depend on that.
- Every app validates its variables once at startup with `createEnv(shape)` (zod) and crashes with
  a readable list when something is missing or malformed.
- Turborepo strict env mode: a task only sees variables declared in `turbo.json` (`globalEnv`:
  `NODE_ENV`, `CI`; `db:migrate` → `DATABASE_URL`; Docker and `TESTCONTAINERS_*` variables pass
  through). Declare new variables there; the lint rule `turbo/no-undeclared-env-vars` then stops
  complaining.
- `NEXT_PUBLIC_*` is the only prefix that reaches the browser. Never put a secret behind it.
- Never commit `.env`; agents are denied reading it (`.claude/settings.json`).

## Testing policy

- Vitest 5, `vitest run` per workspace through Turborepo; the root `vitest.config.ts` lists every
  workspace as a project for one-shot local runs and IDE integration.
- Anything that touches Postgres or Redis uses testcontainers (`@repo/database/test`,
  `@repo/queue/test`; images `postgis/postgis:18-3.6` and `redis:8-alpine`, the same as
  docker-compose and CI). Mocks are allowed only for external providers (HTTP, mail, AI).
- Tests assert behaviour (results, rows, jobs, thrown domain errors), not implementation (call
  order, private state).
- Test files live next to the code (`*.test.ts`); integration tests in each workspace's `test/`.
- Weakening or skipping a test to go green is a review BLOCKER.

Why: a mock of Prisma or Redis proves that the mock works. The containers cost seconds and prove
the migration, the query and the queue semantics at once.

## IDs

Primary keys are UUID v7 (`@default(uuid(7)) @db.Uuid`): globally unique like v4 but
time-ordered, so B-tree indexes stay compact and insertion order is preserved without a serial.
`@repo/validation` exposes `idSchema = z.uuid()`. Job ids derive from row ids
(`jobIdFor("email", row.id)`), never from counters or timestamps.

## Errors

- Services throw domain errors from `apps/api/src/core/errors.ts`: `NotFoundError`,
  `ForbiddenError`, `ConflictError`, `ValidationError` (each with a `code`, an optional `cause`
  and safe `details`).
- `apps/api/src/core/error-mapping.ts` maps them per transport: `toTRPCError` (`NOT_FOUND`,
  `FORBIDDEN`, `CONFLICT`, `BAD_REQUEST`) and `toHttpStatus` (404, 403, 409, 400). Anything else
  becomes `INTERNAL_SERVER_ERROR` with the fixed message "Internal server error" — internals never
  leak to clients; the cause is logged server-side with the `requestId`.
- The tRPC `errorFormatter` adds `requestId` to every error so users can quote it.
- Database constraint failures are translated once (`translateDatabaseError`,
  `isUniqueViolation`, ... in `packages/database/src/utils/errors.ts`) and turned into domain
  errors in services. Nothing else compares Prisma or Postgres error codes.

## Queue semantics

- Payloads carry IDs only (`{ outboxEmailId, traceId? }`); the worker re-reads the row.
- Producers live in API services and enqueue **after** the transaction commits, via the
  `afterCommit` hook of `withTransaction` (`packages/database/src/utils/transaction.ts`).
- Consumers live only in `apps/worker` (`createWorker` elsewhere is a lint error).
- Job ids are deterministic (`jobIdFor(prefix, id)`, charset `[A-Za-z0-9_-]`), so re-enqueueing
  is a no-op and duplicates collapse.
- Workers are idempotent: re-read the row, no-op if already done, then mark done.
- Queue names are registered in `QUEUE_NAMES`; defaults come from `DEFAULT_JOB_OPTIONS` (5
  attempts, exponential backoff from 3 s, completed jobs kept 24 h / at most 1000, failed jobs
  kept 7 days).
- Realtime is "signal + invalidate" over Redis pub/sub (`createPubSub`, separate publisher and
  subscriber connections); messages are IDs, the DB row is the truth.

## Failed jobs and manual retry

Two facts collide: the job id is deterministic (derived from the row), and failed jobs are removed
from Redis after 7 days (`removeOnFail`). While the failed job exists, adding a job with the same
id is a no-op — a naive "retry by re-enqueueing" does nothing. After it is removed, Redis has no
memory of the failure at all — a naive "list failed jobs" shows nothing. Redis can therefore
neither block nor report failures reliably.

The outbox row is the only place that can: `status PENDING | SENT | FAILED`, `attempts`,
`lastError`, `sentAt`.

- The processor marks the row `FAILED` (with `lastError`) when it exhausts its attempts or throws
  `UnrecoverableError`.
- The sweeper (a repeatable job via BullMQ 6 job schedulers) re-enqueues only stale `PENDING`
  rows, so a permanently failing job is not retried forever, and a job lost between commit and
  enqueue (crash, Redis flush, failed after-commit hook) is recovered.
- Manual retry is an operation on the row: set `FAILED` back to `PENDING` (and, while the failed
  job still exists in Redis under the same id, remove or retry that job); the sweeper — or an
  explicit re-enqueue — takes it from there.

Phase 1 implements this for `OutboxEmail` (sweeper every 2 minutes for rows older than 1 minute);
every later outbox follows the same pattern.

## Docker and Apple Silicon

`docker-compose.yml` runs `postgis/postgis:18-3.6` (Postgres 18 + PostGIS, needed from Phase 7,
zero cost now), `dpage/pgadmin4:9` preconfigured from the `POSTGRES_*` variables,
`redis:8-alpine` with append-only persistence, and optionally `redis/redisinsight:3.8`
(`docker compose --profile tools up -d`). Healthchecks gate `yarn docker:up`
(`docker compose up -d --wait`); data lives in named volumes.

`postgis/postgis` is published for `linux/amd64` only, so on Apple Silicon Docker Desktop runs it
under Rosetta emulation — correct but slower. For native speed put this in `.env`:

```text
POSTGRES_IMAGE=imresamu/postgis:18-3.6
POSTGRES_PLATFORM=linux/arm64
```

(`imresamu/postgis` is a multi-arch build of the same Dockerfiles.) Testcontainers use
`postgis/postgis:18-3.6` as well; override with `TEST_POSTGRES_IMAGE` if pulls are slow.

## Versions policy

- Pin exact versions (`.yarnrc.yml` sets `defaultSemverRangePrefix: ""`); no `^` or `~`. The
  lockfile is committed and CI installs with `--immutable`.
- Before adding or upgrading a package run `npm view <pkg> version` and state why the dependency
  is needed. If the latest majors of two packages are incompatible, stop, report and propose the
  newest compatible pair (see `docs/adr/0001-stack.md` for the current ones: TypeScript 6.0 not 7,
  Prisma 7 not the 8 release candidate).
- Read current docs (Context7) for Prisma, Better Auth, tRPC, BullMQ, shadcn and Next.js before
  using an API from memory — they change often.
- Dependency swaps and major upgrades get an ADR.

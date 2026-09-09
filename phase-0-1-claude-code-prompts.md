# Phase 0 + 1 — Claude Code prompt багц

## A. Таны шаардлагын review — юуг засав

| Шаардлага                             | Дүгнэлт                                                                                                                                                                                                                   | Засвар / нэмэлт                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth + User CRUD + CASL               | ✅ Зөв scope — бүх давхаргаар дамжсан нимгэн зүсэлт (walking skeleton) болно                                                                                                                                              | —                                                                                                                                                                                                                                                                 |
| tRPC only, Yoga/REST хойшлуулах       | ✅                                                                                                                                                                                                                        | `core/` фолдерийг transport-agnostic хийж тавина, ингэвэл хожим нэмэхэд фолдер л нэмэгдэнэ                                                                                                                                                                        |
| BullMQ + Redis "мөш зөв"              | ⚠️ Хэрэглэгчгүй infra = үхмэл код                                                                                                                                                                                         | Phase 1-д **нэг бодит job**-оор баталгаажуулна: Better Auth-ийн email verification/welcome mail → outbox → queue → worker. Загвар нь эхнээсээ бодит ачаалалтай                                                                                                    |
| Хамгийн сүүлийн version               | ⚠️ "Latest" нь өөр хоорондоо нийцэхгүй байж болно (Prisma 7 config өөрчлөлт, Tailwind 4 ↔ shadcn, Next/React major)                                                                                                       | Prompt-д: `npm view <pkg> version`-аар шалгаад pin хий, нийцэлгүй бол нэг major доош бууж **тайлбарлаад** миний OK ав. Context7 MCP чинь холбогдсон — docs-ийг тэндээс уншуулна                                                                                   |
| Docker: postgres, pgadmin, redis      | ✅                                                                                                                                                                                                                        | Postgres-ийг **postgis/postgis** image-ээр эхлүүл (Phase 7-д солих шаардлагагүй болно, өртөг 0). RedisInsight сонголттой                                                                                                                                          |
| eslint/ts config best practice        | ✅                                                                                                                                                                                                                        | ESLint 9 flat config, typescript-eslint strict, **eslint-plugin-boundaries**-ээр давхаргын дүрмийг lint түвшинд албадах (service → trpc импортолж чадахгүй г.м)                                                                                                   |
| Code standard "хаана заах вэ"         | ⚠️ Гол зарчим: **баримт бичигт байгаа дүрэм гуйвдаг, tool-д байгаа дүрэм гуйвдаггүй**                                                                                                                                     | Arrow function, import order, naming г.м бүгдийг ESLint/Prettier-д кодчилно; husky + lint-staged pre-commit; CI gate. CLAUDE.md нь tool-оор шалгагдахгүй зүйлсийг л (архитектурын шийдвэр, давхаргын гэрээ) агуулна. Хүнд зориулсан тайлбар `docs/conventions.md` |
| protocol.md / CLAUDE.md / AGENTS.md   | ⚠️ Claude Code-ийн төрөлх файлууд: `CLAUDE.md`, `.claude/rules/*.md`, `.claude/agents/*.md`, `.claude/commands/`, `.claude/skills/*/SKILL.md`, `.claude/settings.json`. `AGENTS.md` нь бусад tool-ийн (Codex г.м) конвенц | `CLAUDE.md` = эх сурвалж (**150 мөрөөс бага** — урт болбол дагалт буурдаг), `AGENTS.md` = CLAUDE.md руу заасан symlink/pointer, `protocol.md` = CLAUDE.md-ээс reference хийгдсэн orchestration баримт                                                             |
| Orchestration: хэдэн agent            | ⚠️ Олон agent = overhead; ганц хөгжүүлэгчид 4 хангалттай                                                                                                                                                                  | planner / implementer / reviewer / verifier — доор нарийвчилсан                                                                                                                                                                                                   |
| Skills: prisma, shadcn, nextjs, react | ✅ + нэмэлт                                                                                                                                                                                                               | react-г nextjs-д нэгтгэ. Нэмэх: trpc, casl, bullmq-jobs, testing, adr. Байгууллагын `git-workflow`, `attributing-ai-authorship` skills-ээ мөн холбо                                                                                                               |

**Жагсаалтад ДУТУУ байсан, prompt-д нэмсэн зүйлс:**

- Testing setup (Vitest + testcontainers) — Phase 0-д заавал, дараа нэмэхэд хэцүү
- CI pipeline (verify gate + migrate diff)
- Env validation (zod, app бүрд)
- `packages/logger` (pino + redact)
- Commit конвенц (conventional commits + commitlint) + AI authorship attribution
- **Multi-tenant шийдвэр** — доор

## B. Prompt өгөхөөс ӨМНӨ шийдэх 3 зүйл

1. **Multi-tenant эсэх?** Олон байгууллага (organizationId бүх хүснэгтэд, CASL нөхцөлд) уу, нэг компанийн дотоод систем үү? Prompt default: **single-tenant** (Better Auth admin plugin + role). Multi бол Master Context-ийн тухайн мөрийг соль.
2. **CI платформ:** GitHub Actions (Tab-Systems-Mongolia org) гэж бичсэн. GitLab бол соль.
3. **Repo нэр / namespace:** `@repo/*` гэж бичсэн — өөрийн нэрээр соль (`@wf/*` г.м).

## C. Ажиллуулах дараалал

```
1. Хоосон repo-д git init, Claude Code асаа
2. Master Context + Prompt 0 → plan-ыг нь батал → ажиллуул → yarn verify, docker up шалга → commit
3. (шинэ session) Master Context + Prompt 1 → plan-ыг батал → ажиллуул → шалга → commit
```

Prompt бүр "plan гаргаад ЗОГС" гэсэн заалттай — файлын жагсаалтыг харж байж OK өг.

---

## D. Master Context (хоёр prompt-ийн өмнө өгнө)

```
PROJECT CONTEXT

Greenfield project: form-template + approval-workflow system (templates → routes →
submissions → multi-step approval). This session builds the foundation only.

Stack (fixed decisions — do not substitute):
- Turborepo + Yarn 4 (berry, nodeLinker: node-modules), TypeScript strict everywhere
- apps/web: Next.js App Router + Tailwind + shadcn/ui (components live in packages/ui)
- apps/api: Hono + tRPC (only transport for now; structure must allow adding
  GraphQL/REST later as sibling folders) + Better Auth
- apps/worker: BullMQ workers (separate process, never inside api)
- packages/database: Prisma + PostgreSQL (postgis/postgis image), repositories live HERE
- packages/validation (zod), packages/auth (Better Auth), packages/permissions (CASL),
  packages/queue (BullMQ + ioredis wrapper), packages/ui, packages/logger (pino),
  packages/eslint-config, packages/typescript-config
- Tenancy: SINGLE-TENANT (one organization). Use Better Auth admin plugin + roles;
  do NOT use the organization plugin. Roles: admin, hr_manager, dept_head, member.
- Package namespace: @repo/*   (rename if instructed)
- CI: GitHub Actions

Architecture contract (enforced by ESLint boundaries where possible):
  transport adapter (trpc/) → service (modules/) → repository (packages/database) → prisma
- Transports never contain business logic; services never import transport code;
  repositories contain only data access (no validation, no business rules).
- Domain errors (NotFoundError, ForbiddenError, ConflictError, ValidationError) are
  thrown by services from apps/api/src/core/errors.ts and mapped to transport errors
  in apps/api/src/core/error-mapping.ts. Services never throw TRPCError.
- Request context is built once in apps/api/src/core/context.ts
  (headers → { user, ability, logger, requestId }) and wrapped by each transport.
- Authorization has two layers: CASL ability (who may do what kind of thing) in
  packages/permissions, and stateful workflow checks inside services. Never encode
  workflow state into CASL.
- Queue: typed payloads with IDs only; producers in api services AFTER the DB
  transaction commits; consumers only in apps/worker; deterministic jobIds;
  workers are idempotent (re-read from DB, no-op if already done).
- Realtime and side-effects: DB row is the source of truth (outbox pattern).

Code standards (encode in tooling, not prose):
- Arrow functions only (ESLint func-style: expression + prefer-arrow-callback),
  no default exports except where frameworks require (Next.js pages/layouts,
  config files) — enforce via eslint overrides.
- File names kebab-case with role suffix: user.service.ts, user.repository.ts,
  user.router.ts, user.schema.ts, notification.processor.ts. React components
  PascalCase.tsx. One exported unit per file where practical.
- Prettier: printWidth 100, double quotes, semicolons, trailing commas "all".
- No `any`, consistent-type-imports, import/order with alias groups.
- Layer boundaries via eslint-plugin-boundaries (configure element types:
  transport, service, repository, package).

Versions: install the LATEST stable of every package. Before adding a dependency run
`npm view <pkg> version` and pin the exact version. If two latest majors are
incompatible (e.g., Tailwind ↔ shadcn, Prisma ↔ Better Auth adapter), stop, report
the conflict, and propose the newest compatible pair before proceeding. Use the
Context7 MCP tool to read current docs for Prisma, Better Auth, tRPC, BullMQ, shadcn,
Next.js instead of relying on memory — APIs of these libraries change frequently.

Process rules for this session:
- FIRST read the repo state, then present a file-level plan and WAIT for approval.
- Work in small steps; after each step run the relevant checks.
- Every step must keep `yarn verify` (lint + typecheck + test + build) green.
- Write tests alongside code (Vitest; testcontainers for anything touching Postgres/Redis).
- Never commit secrets; .env.example only.
- Commit messages: Conventional Commits; mark AI-assisted commits per
  the project's attribution rule (see CLAUDE.md once created).
```

---

## E. Prompt 0 — Scaffold, tooling, orchestration файлууд

```
PHASE 0 — FOUNDATION SCAFFOLD (no product features)

Deliver a runnable, empty-but-wired monorepo with all tooling, conventions and
agent-orchestration files in place. Nothing domain-specific except a health check.

1. Monorepo
   - Turborepo + Yarn 4 workspaces. turbo.json tasks: build (dependsOn ^build,
     outputs .next/** !.next/cache/** dist/**), dev (persistent, no cache),
     lint, typecheck, test (dependsOn ^build), db:generate (cache:false),
     db:migrate (cache:false), verify = lint typecheck test build.
   - Root scripts: dev, build, verify, db:generate, db:migrate, db:studio, format.
   - .nvmrc / engines pinned to current LTS Node.

2. packages/typescript-config: base.json (strict, noUncheckedIndexedAccess,
   exactOptionalPropertyTypes, verbatimModuleSyntax, isolatedModules),
   nextjs.json, node.json, react-library.json.

3. packages/eslint-config: ESLint 9 flat config presets — base, node, next, react.
   Include: typescript-eslint strictTypeChecked, eslint-plugin-import (order,
   no-default-export with framework overrides), eslint-plugin-boundaries (layer
   rules from Master Context), func-style expression + prefer-arrow-callback,
   no-console (allow in packages/logger and apps/worker bootstrap), unicorn
   filename-case kebab (PascalCase allowed for *.tsx components), prettier
   integration. Add a short comment on top of each rule group explaining WHY.

4. Formatting & hooks: Prettier config, husky + lint-staged (eslint --fix,
   prettier), commitlint (conventional). CI must fail on any of these.

5. Docker: docker-compose.yml with postgis/postgis (latest), pgadmin4 (preconfigured
   server connection via servers.json), redis (latest alpine, appendonly),
   optional redisinsight. Healthchecks on postgres and redis. Named volumes.
   `yarn docker:up / docker:down`.

6. packages/database: Prisma (latest — check whether prisma.config.ts is now
   required and whether a driver adapter is needed for the TS client). Empty
   schema except a `HealthCheck` table used by tests. src/client.ts singleton,
   src/repositories/index.ts (empty barrel), src/utils/{pagination,errors,
   transaction}.ts with tests (errors.ts maps Postgres unique-violation code).
   Seed script placeholder.

7. packages/logger: pino with redact paths (cookie, authorization, password,
   token), child-logger helper. packages/validation: zod re-export + env schema
   helper `createEnv(schema)`. packages/queue: connection factory
   (maxRetriesPerRequest: null), createQueue<T> with default job options
   (attempts 5, exponential backoff 3000, removeOnComplete {age 24h, count 1000},
   removeOnFail {age 7d}), createWorker<T>, pub/sub helpers (separate connections
   for publisher/subscriber), QUEUE_NAMES const — NO concrete queues yet.
   Unit tests for connection options and jobId helper `jobIdFor(prefix, id)`.

8. apps/api: Hono server with env validation (zod), packages/logger request-id
   middleware, core/ folder (context.ts with placeholder user=null, errors.ts,
   error-mapping.ts with toTRPCError), trpc/ (initTRPC, router, publicProcedure,
   protectedProcedure that throws UNAUTHORIZED, one `health.ping` procedure),
   GET /health checking prisma + redis. Graceful shutdown on SIGTERM.
   apps/worker: bootstrap that connects to Redis, starts zero workers, logs,
   graceful shutdown. apps/web: Next.js App Router, Tailwind, shadcn init with
   packages/ui as the component target (components.json aliases → @repo/ui),
   tRPC client + React Query provider, one page calling health.ping.
   packages/ui: shadcn Button added via CLI, exports map, globals.css tokens.

9. Testing: Vitest workspace config at root; testcontainers helpers in
   packages/database/test (start postgres, run migrations, provide prisma) and
   packages/queue/test (start redis). One integration test proving both work.

10. CI (.github/workflows/ci.yml): install → docker services (postgres/redis via
    services:) → yarn verify → prisma migrate diff against the schema to detect
    drift. Cache Turbo.

11. Agent orchestration files — create with the EXACT content from Appendix
    sections F, G, H (CLAUDE.md, protocol.md, .claude/rules/*, .claude/agents/*,
    .claude/skills/* skeletons, .claude/settings.json). AGENTS.md is a one-line
    pointer to CLAUDE.md. docs/conventions.md explains the human-readable
    rationale of every lint rule group and the layer contract; docs/adr/0001-
    stack.md records the stack decision (short).

12. README: how to start (docker:up → db:migrate → dev), folder map, layer diagram.

Definition of done: fresh clone → yarn → yarn docker:up → yarn db:migrate →
yarn dev boots web+api+worker; web page shows health ping OK; yarn verify green;
CI green; a deliberately misplaced import (service importing from trpc/) fails lint.
```

---

## F. Prompt 1 — Auth + User CRUD + CASL + нэг бодит queue job

```
PHASE 1 — AUTH, USER MANAGEMENT, PERMISSIONS, FIRST REAL JOB

Build the thinnest complete vertical slice: sign-in → protected tRPC → CASL →
service → repository → Postgres, plus one real background job through the
outbox pattern. This slice becomes the reference implementation every later
feature copies.

1. Better Auth (packages/auth)
   - betterAuth() with prismaAdapter, emailAndPassword, admin plugin, session
     7d/updateAge 1d, additionalFields: employeeCode?, department?, role
     (enum admin|hr_manager|dept_head|member; default member). Read current
     Better Auth docs via Context7 for the admin plugin's access-control API
     and define roles with its statement/role objects (do not invent a
     `roles: []` array if the API differs).
   - Run the Better Auth CLI to generate the Prisma models (User, Session,
     Account, Verification); merge into packages/database schema; migration.
   - emailVerification enabled; the sendVerificationEmail hook must NOT send
     mail inline — see step 4.
   - packages/auth/src/client.ts (React client with admin plugin).
   - apps/api: mount auth handler at /api/auth/*; core/context.ts now resolves
     the session and builds ability (step 3); protectedProcedure typed user.
   - CORS: allow web origin with credentials; cookie settings documented for
     same-parent-domain deployment (docs/adr/0002-auth.md).
   - Rate limit on /api/auth/sign-in/* using Redis (rate-limiter-flexible).

2. User module (reference implementation)
   - packages/database/src/repositories/user.repository.ts: findById,
     findByEmail, findMany({page, perPage, search?, role?}), count, update,
     softDelete (deletedAt). Pure data access, typed with Prisma types.
   - apps/api/src/modules/user/user.service.ts: getById (NotFoundError if
     missing/deleted), list (perPage max 100, uses CASL accessibleBy filter),
     updateProfile (self or admin), changeRole (admin only, cannot demote the
     last admin — ConflictError), deactivate (soft delete + revoke sessions via
     Better Auth admin API). Services take `ctx: RequestContext` as first arg.
   - packages/validation/src/user.schema.ts: updateProfileSchema,
     changeRoleSchema, listUsersSchema (shared with web forms).
   - apps/api/src/trpc/routers/user.router.ts: me, byId, list, updateProfile,
     changeRole, deactivate — each: zod input → ability check → service.
     Add `.claude/rules/module-template.md` describing this 4-file pattern
     (schema, repository, service, router) as the mandatory template.

3. CASL (packages/permissions)
   - Isomorphic: defineAbilityFor(user) with actions manage|create|read|update|
     delete|changeRole and subjects User|all. Rules: admin manage all;
     hr_manager read all users + update users in own department; everyone read
     self + update self. Export AppAbility type, subject helpers, and an
     accessibleBy re-export from @casl/prisma.
   - tRPC middleware attaches ability from context; a `requireAbility(action,
     subject)` helper for routers.
   - Matrix test: for each role × action × (self|other|same-dept|other-dept)
     assert can/cannot. This test file is the permission spec — comment it so.
   - Web: `Can` component / useAbility hook to hide UI (never as the only guard).

4. First real job — email via outbox (proves the whole queue design)
   - Prisma: OutboxEmail { id, to, template, payload Json, status
     PENDING|SENT|FAILED, attempts, sentAt?, lastError?, createdAt }.
   - packages/queue: QUEUE_NAMES.email, EmailJob = { outboxEmailId: string;
     traceId?: string }, emailQueue via createQueue.
   - Better Auth sendVerificationEmail hook → apps/api email.service:
     insert OutboxEmail row (inside the same transaction when one exists),
     then enqueue AFTER commit with jobId `email-<id>`. Never enqueue inside
     the transaction.
   - apps/worker/src/processors/email.processor.ts: load row; no-op if SENT;
     send via a MailProvider interface (dev: Mailpit/console provider — add
     Mailpit to docker-compose); mark SENT; on final failure mark FAILED with
     lastError. Concurrency 5, limiter 20/s.
   - Sweeper: repeatable job every 2 minutes re-enqueuing PENDING rows older
     than 1 minute (status != FAILED). Document the FAILED/manual-retry
     semantics in docs/conventions.md (why deterministic jobId + removeOnFail
     requires a separate FAILED state).
   - Tests: transaction rollback → no row, no job; duplicate jobId no-op;
     worker idempotency; sweeper recovers a PENDING row when Redis was flushed.

5. Web (apps/web)
   - /login, /register, /verify-email pages using packages/ui components and
     react-hook-form + zodResolver with schemas from @repo/validation.
   - /dashboard (protected via middleware + server-side session), /users list
     with pagination/search (admin & hr_manager), /users/[id] edit,
     /profile self-edit. Role badge via composed StatusBadge in packages/ui.
   - tRPC client sends cookies (credentials: include).

6. Observability minimal: requestId in every log line and in TRPCError data;
   worker logs traceId from job payload.

7. Docs: docs/adr/0002-auth.md, 0003-permissions.md (two-layer authz),
   0004-outbox.md. Update README with the "how to add a new module" walkthrough
   pointing to .claude/rules/module-template.md.

Definition of done: register → verification email visible in Mailpit (via worker)
→ login → dashboard; admin can list/edit/change role; member sees only self and
gets FORBIDDEN otherwise; ability matrix test green; kill the worker during
registration → restart → email delivered exactly once; yarn verify + CI green.
```

---

## G. CLAUDE.md (эх сурвалж — 150 мөрөөс бага байлга)

```markdown
# CLAUDE.md

## What this is

Form-template & approval-workflow system. Turborepo monorepo. See README for setup,
docs/conventions.md for rationale, protocol.md for how agents work here.

## Non-negotiable architecture

- Layers: transport (apps/api/src/trpc) → service (apps/api/src/modules) →
  repository (packages/database/src/repositories) → prisma. Never skip or reverse.
- Services throw domain errors from apps/api/src/core/errors.ts, never TRPCError.
- Request context built once in apps/api/src/core/context.ts.
- Authorization = CASL ability (packages/permissions) + stateful checks in services.
- Queue: ID-only payloads, enqueue after commit, consumers only in apps/worker,
  deterministic jobIds, idempotent workers, DB row is truth (outbox).
- New module = follow .claude/rules/module-template.md exactly.

## Working rules

- Read before writing. Present a file-level plan and wait for approval before
  creating/modifying more than 3 files.
- TDD: write or update the test with the code. Anything touching Postgres/Redis
  uses testcontainers, not mocks.
- `yarn verify` must be green before you declare a step done. Run it.
- Prefer editing over adding. No new dependency without stating why and checking
  `npm view <pkg> version`. Use Context7 for library docs; do not rely on memory
  for Prisma, Better Auth, tRPC, BullMQ, shadcn APIs.
- Do not touch: prisma migrations already applied, .env files, CI secrets.
- Schema changes require an ADR note (docs/adr) and expand-contract safe migration.
- Commits: Conventional Commits. AI-assisted commits carry the attribution trailer
  defined in docs/conventions.md#ai-attribution.

## Style (enforced by ESLint/Prettier — fix lint, don't argue with it)

Arrow functions; kebab-case files with role suffix; no default exports except
Next.js/config; no `any`; type-only imports; import order by alias groups.

## Pointers

- protocol.md — planner/implementer/reviewer/verifier flow
- .claude/rules/ — path-scoped rules (auto-loaded)
- .claude/skills/ — how-to guides per library
- docs/adr/ — why decisions were made
```

`AGENTS.md`: `See CLAUDE.md (single source of truth for AI agents in this repo).`

---

## H. protocol.md — Orchestration protocol

```markdown
# Orchestration protocol

Four roles. The main Claude Code session is the ORCHESTRATOR and delegates to
subagents defined in .claude/agents/. Roles never overlap in one turn.

## Roles

1. planner (read-only) — turns a ticket into a file-level plan with test list.
2. implementer — executes ONE plan step at a time, TDD, runs checks.
3. reviewer (read-only) — reviews the diff against CLAUDE.md, .claude/rules,
   and the plan; outputs a findings list, never edits.
4. verifier (read-only + run) — runs `yarn verify`, targeted tests, docker
   smoke; reports pass/fail with logs. Never edits.

## Flow (per ticket / MR)

Step 0 Intake Orchestrator restates the ticket, acceptance criteria, and
constraints. Asks the human ONLY for genuinely missing info.
Step 1 Plan planner → plan.md in the ticket branch: files to touch,
schema changes (flag!), tests to add, risks. Human approves.
Hard limits: ≤15 files per MR; schema change ⇒ ADR line.
Step 2 Implement implementer executes plan steps sequentially. After each step:
lint + typecheck + affected tests. Stops on the first failure
it cannot fix in 2 attempts and reports.
Step 3 Verify verifier runs full `yarn verify` + integration tests.
Step 4 Review reviewer checks: layer boundaries, error handling via domain
errors, CASL check present on every non-public procedure,
queue rules (ID-only, after-commit, idempotent), tests exist
and assert behavior not implementation, naming, no secrets.
Output: BLOCKER / SHOULD / NIT list with file:line.
Step 5 Fix loop implementer addresses BLOCKER+SHOULD; back to Step 3.
Max 2 loops; then escalate to human.
Step 6 Close Orchestrator writes MR description (summary, test evidence,
ADR links, AI attribution), updates docs if behavior changed.

## Guardrails

- Subagents receive only the context they need (plan.md, relevant files).
- No subagent may run destructive git or DB commands (reset, drop, migrate reset).
- Any deviation from the approved plan requires re-approval.
- If tests are weakened or skipped to go green, the reviewer marks BLOCKER.
```

`.claude/agents/planner.md`, `implementer.md`, `reviewer.md`, `verifier.md` — тус
бүрд: role, allowed tools (planner/reviewer: Read, Grep, Glob only; verifier: + Bash
restricted to yarn/docker/test commands; implementer: full edit), input/output
format, the checklist above copied verbatim for reviewer.

---

## I. `.claude/rules/` (path-scoped, автоматаар ачаалагдана)

| Файл                 | Хамрах                                        | Агуулга                                                                                        |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `layers.md`          | бүх repo                                      | Давхаргын гэрээ + зөвшөөрөгдсөн import чиглэл, жишээ зөв/буруу                                 |
| `module-template.md` | apps/api/src/modules/**                       | 4-файлын загвар (schema/repository/service/router), нэрлэлт, ctx эхний аргумент, error төрлүүд |
| `repositories.md`    | packages/database/**                          | Зөвхөн data access; Prisma type-уудыг гадагш дамжуулах; raw SQL зөвхөн энд                     |
| `queue.md`           | packages/queue/**, apps/worker/**             | ID-only, after-commit, deterministic jobId, idempotent, FAILED семантик, sweeper               |
| `permissions.md`     | packages/permissions/**, apps/api/src/trpc/** | Хоёр давхар authz; procedure бүр ability шалгалттай; matrix тест шаардлага                     |
| `ui.md`              | packages/ui/**, apps/web/**                   | shadcn primitives vs composed/; өргөх дүрэм; server/client component зааг                      |
| `testing.md`         | **/*.test.ts                                  | testcontainers, behavior тест, mock-ийн хязгаар                                                |
| `migrations.md`      | packages/database/prisma/**                   | expand-contract, ADR шаардлага, applied migration-д гар хүрэхгүй                               |

---

## J. `.claude/skills/` — суулгах skills

Skill = `.claude/skills/<name>/SKILL.md` (+ хэрэгтэй бол scripts/, examples/).
Prompt 0-д араг ясыг үүсгэж, Prompt 1-ийн явцад бодит жишээгээр баяжуулна.

| Skill         | Яагаад                                | Агуулга                                                                                               |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `prisma`      | Migration/schema сахилга              | Expand-contract алхмууд, Unsupported() хэрэглээ, repository-д raw SQL, testcontainers helper хэрэглээ |
| `trpc`        | Router/procedure загвар               | Procedure бүтэц, input→ability→service дараалал, error mapping, client hooks нэрлэлт                  |
| `better-auth` | API нь хурдан хувьсдаг                | Config хаана, CLI generate урсгал, session авах (server/client), admin API                            |
| `casl`        | Ability дизайн                        | Rule бичих хэв, accessibleBy repository-д дамжуулах, matrix тест template                             |
| `bullmq-jobs` | Queue дүрэм                           | Шинэ job нэмэх алхам (type→queue→processor→sweeper шаардлагатай юу), outbox жишээ                     |
| `shadcn-ui`   | Monorepo CLI нюанс                    | `npx shadcn add -c apps/web` → packages/ui; composed/ хэзээ; theming CSS var                          |
| `nextjs`      | App Router зааг (react-г үүнд нэгтгэ) | server vs client component шийдэх, session server-side, tRPC provider, form + zodResolver             |
| `testing`     | Нэг мөр тест хэв                      | Vitest наming, testcontainers lifecycle, factory helpers, юуг mock хийхгүй                            |
| `adr`         | Шийдвэр тэмдэглэх                     | 5-мөрийн ADR template, хэзээ бичих                                                                    |

Байгууллагын skills (`git-workflow`, `attributing-ai-authorship`, `backlog-usage`)-ийг
CLAUDE.md-ийн Pointers хэсэгт заа — Claude Code эдгээрийг ажлын байрын orchestrator-оос
уншдаг бол давхардуулж хуулах шаардлагагүй.

---

## K. Хүлээгдэх асуултууд (Claude Code гарцаагүй асуух)

- Prisma latest-ийн config хэлбэр (prisma.config.ts / driver adapter) — Context7-оос уншуулж, ADR-д бич
- Tailwind 4 + shadcn нийцэл — shadcn CLI-ийн одоогийн дэмжлэгээр яв
- Better Auth admin plugin-ий role API — docs-ийн дагуу, `roles: []` таамаглахгүй
- Yarn 4 + Next.js: `nodeLinker: node-modules` заавал (PnP-тэй асуудалтай)

```

```

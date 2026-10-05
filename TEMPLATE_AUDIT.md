# Template audit — turning `d-round` into a reusable monorepo template

Date: 2026-09-29 · Scope: read-only audit of the working tree at commit `4b3607f` plus the
uncommitted seed change. Nothing was modified.

What was actually run to back the findings:

| Check                                  | Result                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `turbo run lint typecheck --continue`  | 22 / 22 tasks green                                                                     |
| `turbo run format:check`               | **fails** — 41 files, all untracked `.agents/skills/**` (vendored skills)               |
| `turbo run test` / `build`             | not run: Docker is not running on this machine and every test suite uses testcontainers |
| dependency scan (imports vs manifests) | no phantom dependencies; 3 declared-but-unused (see §5)                                 |

---

## 1. Actual stack per workspace vs the reference structure

| Reference                    | Actual workspace          | Stack found                                                                                                                                                           | Verdict                                              |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/web`                   | `@repo/web`               | Next.js 16.3 App Router, React 19, Tailwind v4, shadcn (`base-nova` / `@base-ui/react`), tRPC 11 client + TanStack Query 5, Better Auth React client, react-hook-form | matches; **no test setup**                           |
| `apps/api`                   | `@repo/api`               | **Hono 4 + tRPC 11** (`@hono/trpc-server`, superjson). No Express, no GraphQL. Better Auth mounted at `/api/auth`, Redis rate limit, pino, zod env, tsdown bundle     | matches (Hono+tRPC, not mixed)                       |
| `apps/worker` (if BullMQ)    | `@repo/worker`            | BullMQ 6 consumers (email processor + outbox sweeper), nodemailer SMTP, tsdown bundle                                                                                 | matches                                              |
| `packages/database`          | `@repo/database`          | Prisma 7.10 multi-file schema, `@prisma/adapter-pg`, `prisma.config.ts`, 2 migrations, seed, repositories, testcontainers helper                                      | matches                                              |
| `packages/ui`                | `@repo/ui`                | shadcn primitives, 20 react-hook-form fields, composed DataTable/ConfirmDialog/StatusBadge, theme tokens                                                              | matches; **no test setup**                           |
| `packages/eslint-config`     | `@repo/eslint-config`     | ESLint 10 flat presets base/node/react/next + `boundaries.js` layer contract                                                                                          | matches                                              |
| `packages/typescript-config` | `@repo/typescript-config` | base/node/nextjs/react-library                                                                                                                                        | matches                                              |
| `packages/logger` (opt.)     | `@repo/logger`            | pino 10 with mandatory redaction                                                                                                                                      | matches                                              |
| `packages/trpc` (opt.)       | —                         | not needed: `AppRouter` type is exported from `@repo/api/router` and consumed type-only by web                                                                        | deliberate omission, keep                            |
| `packages/graphql-types`     | —                         | no GraphQL transport exists (folders `apps/api/src/graphql                                                                                                            | rest`are pre-classified in`boundaries.js` for later) | not applicable |
| `packages/config` (opt.)     | —                         | env helpers live in `@repo/validation/env` (`createEnv`, `portSchema`, …)                                                                                             | deliberate omission, keep                            |
| (not in reference)           | `@repo/auth`              | Better Auth server config + admin plugin access control + React client                                                                                                | keep, generic                                        |
| (not in reference)           | `@repo/permissions`       | CASL 7 (browser + Prisma abilities, React `Can`)                                                                                                                      | keep, but rules are domain-specific                  |
| (not in reference)           | `@repo/queue`             | BullMQ + ioredis wrapper, deterministic job ids, testcontainers Redis                                                                                                 | keep, generic                                        |
| (not in reference)           | `@repo/validation`        | zod 4 single entry point, shared schemas, `createEnv`                                                                                                                 | keep; `user.schema.ts` is domain-specific            |

All twelve internal packages are named `@repo/<name>`. Single `yarn.lock`, Yarn 4.14 with
`nodeLinker: node-modules`, exact version pins, Node 24 via `.nvmrc`.

---

## 2. Checklist

| #   | Item                                      | Status | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `turbo.json` pipeline                     |   ✅   | build/dev/lint/test/typecheck/db:generate/db:migrate defined, `^build` + `^db:generate` deps, `@repo/database#*` depend on `db:generate`, `.next`/`dist` outputs, `globalEnv` + `globalPassThroughEnv` declared. `NEXT_PUBLIC_*` reaches web via Turbo's Next.js framework inference.                                                                                                                                                        |
| 2   | Root scripts                              |   ⚠️   | All present and lint/typecheck green. `yarn verify` is currently **red** because `format:check` hits the untracked `.agents/` folder (not in `.prettierignore`). Tests unverified here (no Docker).                                                                                                                                                                                                                                          |
| 3   | Yarn workspaces / lockfile / hoisting     |   ✅   | One lockfile, `workspace:*` links, no phantom imports. Minor: 3 unused declared deps (§5).                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Shared configs consumed everywhere        |   ✅   | Every workspace `extends` `@repo/typescript-config/*` and imports a `@repo/eslint-config` preset. Only justified local overrides (shadcn primitives in `packages/ui`, `no-console` in worker bootstrap, `src/generated` ignore in database).                                                                                                                                                                                                 |
| 5   | Env handling                              |   ⚠️   | `.env.example` complete; api + worker validate with zod (`createEnv`); web has **no validation** (`apps/web/lib/env.ts` silently defaults to localhost). No secrets committed (`.env` git-ignored; local `.env` holds dev values only). Values are project-specific (`POSTGRES_DB=workflow`, `MAIL_FROM="d-round …"`).                                                                                                                       |
| 6   | CI/CD                                     |   ⚠️   | `.github/workflows/ci.yml` runs `yarn verify` through Turbo with Yarn + `.turbo` GitHub caches, migrations + schema-drift check, commitlint. No Turbo remote cache (optional). Hard-coded `workflow` DB name and `postgis/postgis:18-3.6` (also duplicated in compose, testcontainers default, docs). No deploy/Docker build job.                                                                                                            |
| 7   | Docker compose for local dev              |   ✅   | Postgres (PostGIS), pgAdmin (auto-connected), Redis, Mailpit, RedisInsight profile, health checks, `--wait`. Project name `d-round` hard-coded in `docker-compose.yml:1` and `docker/pgadmin/entrypoint.sh:12`. No app Dockerfiles (not required for local dev).                                                                                                                                                                             |
| 8   | Git hygiene                               |   ⚠️   | `.gitignore` covers all outputs/generated/env; husky `pre-commit` (lint-staged) + `commit-msg` (commitlint); `.editorconfig`. Missing: `.agents/` in `.prettierignore` (breaks verify), PR template, CODEOWNERS, dependabot/renovate.                                                                                                                                                                                                        |
| 9   | Docs                                      |   ⚠️   | README is excellent but is a **d-round Phase 0/1 walkthrough** (roles table, seed accounts, phase text). `CLAUDE.md` + `.claude/rules` + `.claude/skills` + `docs/conventions.md` + 4 ADRs are strong and mostly generic, but reference d-round roles, seed users, phase migration names, "Phase 7 PostGIS". Two Mongolian planning docs at repo root. Per-workspace READMEs only where useful (eslint-config, processors, composed, hooks). |
| 10  | Prisma schema generic / seed / migrations |   ⚠️   | `HealthCheck`, Better Auth models, `OutboxEmail` are generic. `User` carries d-round fields (`employeeCode`, `department`, `@@index([department])`) and a role comment `admin                                                                                                                                                                                                                                                                | hr_manager | dept_head | member`. Seed = 5 `*@test.com`users with HR/Engineering departments. Two migrations named by project phase. **Uncommitted**`SEED_PASSWORD` change (`A123456`→`A12345678`) while README, `.claude/rules/migrations.md`, `.claude/skills/prisma/SKILL.md`and the seed comment still say`A123456` (`passwordSchema` requires ≥ 8, so the new value is the correct one). |
| 11  | Prisma client singleton + scripts         |   ✅   | `getPrismaClient` / `createPrismaClient` / `disconnectPrismaClient`; `db:*` scripts wired into Turbo and root; `postinstall` runs `prisma generate` without a DB (sentinel URL in `prisma.config.ts`); `src/generated` git-ignored.                                                                                                                                                                                                          |
| 12  | apps/api layered + generic boilerplate    |   ⚠️   | Layers enforced by ESLint boundaries; context, domain errors, error mapping, env, logging, rate limit, graceful shutdown are generic and reusable. The `user` module is the intended "one example module" but is domain-flavoured (department scoping, `hr_manager`/`dept_head`, `employeeCode`, last-admin rule). `email` + `health` modules are generic.                                                                                   |
| 13  | Health / shutdown / logging               |   ✅   | `GET /health` (Postgres + Redis probes, 200/503) + tRPC `health.ping`; ordered graceful shutdown with deadline in api and worker; pino with redaction, request id, per-request child logger.                                                                                                                                                                                                                                                 |
| 14  | apps/web scaffold                         |   ⚠️   | App Router, `@repo/ui` consumed, tRPC client wired type-safely to `@repo/api/router`, Better Auth session server + client, proxy redirect. More than one example page: home + login/register/verify-email (generic, keep) + dashboard/users/users/[id]/profile (domain-flavoured). `lang="ja"`, title `d-round`, "Phase 1 ships user management" copy.                                                                                       |
| 15  | Testing                                   |   ⚠️   | Vitest + testcontainers in api, worker, database, auth, queue; unit tests in permissions, logger, validation; root `vitest.config.ts` projects. **`apps/web` and `packages/ui` have no `vitest.config.ts`, no `test` script and zero tests**, so `turbo test` silently skips them.                                                                                                                                                           |
| 16  | Hard-coded project-specific values        |   ❌   | ~30 occurrences across 20 files (§4). No `romuten`/`daigaku` references in tracked code; `romuten-v3` appears only in the root planning doc.                                                                                                                                                                                                                                                                                                 |
| 17  | Dead workspaces / unused deps / leftovers |   ⚠️   | No dead workspaces. Unused deps: `bullmq` (apps/worker, only via `@repo/queue`), `date-fns` (packages/ui), `@repo/logger` devDep (packages/queue). Leftovers: root planning docs, `docs/plans/phase-1-plan.md`, untracked `.agents/` + 6 skill symlinks + `skills-lock.json`, empty `apps/web/hooks/`.                                                                                                                                       |

---

## 3. What's missing to be a template (prioritized)

### P0 — blocks reuse

1. **`yarn verify` is red on a fresh checkout that has the vendored skills.** `.agents/skills/**`
   (installed by the `skills` CLI, recorded in `skills-lock.json`, symlinked from
   `.claude/skills/{shadcn,prisma-cli,prisma-client-api,prisma-postgres,create-auth,better-auth-best-practices}`)
   is untracked and not prettier-ignored. Action, pick one:
   - keep them: `git add .agents skills-lock.json .claude/skills/*` and add `.agents/` to
     `.prettierignore`; or
   - drop them: delete `.agents/`, the six symlinks and `skills-lock.json` (the in-repo skills under
     `.claude/skills/{prisma,better-auth,shadcn-ui,...}` already cover the same ground).

2. **Project identity is hard-coded in 16 places** (`d-round`, "Form templates & approval
   workflows", `no-reply@d-round.local`). Full list in §4. Action: replace with placeholders and add
   a one-shot `scripts/init-template.mjs` (or documented `sed` list) that rewrites them; keep the
   runtime brand in one place (`apps/web/lib/brand.ts` + `MAIL_FROM` env) so future renames touch
   one file.

3. **The example domain leaks into every layer.** `User.employeeCode` / `department`, roles
   `hr_manager` / `dept_head`, department-scoped CASL rules, HR/Engineering seed data, department
   fields in register/profile forms and the users table, department examples in ADR 0003 and the
   rules/skills docs. Action (recommended): reduce the template to `admin` + `member`, drop
   `employeeCode`/`department` everywhere, keep the `user` module as the reference module (list,
   byId, me, updateProfile(name), changeRole, deactivate + last-admin rule). Files:
   `packages/database/prisma/schema/auth/user.prisma`, `packages/validation/src/user.schema.ts`,
   `packages/auth/src/access-control.ts`, `packages/permissions/src/rules.ts` (+ `ability.ts`,
   `server.ts`, `test/ability.test.ts`), `packages/database/src/repositories/user.repository.ts`,
   `packages/database/prisma/seed.ts`, `apps/api/src/core/context.ts`,
   `apps/api/src/modules/user/user.service.ts`, `apps/api/test/**`,
   `apps/web/features/{auth,users}/*`, `apps/web/lib/auth/server.ts`,
   `.claude/rules/{module-template,permissions,migrations,testing,ui}.md`,
   `.claude/skills/{casl,prisma,better-auth,nextjs,shadcn-ui,testing}/SKILL.md`,
   `docs/adr/0003-permissions.md`, `docs/conventions.md`.

4. **Migrations and seed are project history, not a template baseline.** Action: squash
   `20260909060455_init` + `20260909113011_phase1_auth_outbox` into one `0001_init` migration
   regenerated from the cleaned schema
   (`prisma migrate diff --from-empty --to-schema prisma/schema --script`), commit the pending
   `SEED_PASSWORD = "A12345678"` fix and update the four places that still say `A123456`
   (`README.md`, `.claude/rules/migrations.md`, `.claude/skills/prisma/SKILL.md`,
   `packages/database/prisma/seed.ts` header comment).

5. **README and planning docs describe d-round, not a template.** Action: rewrite `README.md` as
   "template quick start + folder map + conventions pointers" (drop Phase 1 walkthrough, roles
   table, phase text); change `CLAUDE.md` line 4 to a placeholder; delete
   `phase-0-1-claude-code-prompts.md`, `workflow-development-plan-v2.md`,
   `docs/plans/phase-1-plan.md` and their two `.prettierignore` entries; rewrite the "Context"
   paragraphs of `docs/adr/0001..0004` so they read as template decisions.

### P1 — important

6. **No tests in `apps/web` and `packages/ui`.** Add `vitest.config.ts` (jsdom or happy-dom) +
   `test` script + one sample test each (e.g. `HealthStatus` renders, `TextField` shows an error).
   New devDeps to justify and version-check: `@testing-library/react`, `@testing-library/jest-dom`,
   `jsdom` (or `happy-dom`), `@vitejs/plugin-react`. Both tsconfigs must then include `test/**`.

7. **Postgres image and DB name duplicated.** `postgis/postgis:18-3.6` appears in
   `docker-compose.yml`, `.github/workflows/ci.yml`, `packages/database/test/index.ts`
   (`TEST_POSTGRES_IMAGE` default), `.claude/rules/testing.md`, `docs/conventions.md`, README;
   `workflow` DB name in `.env.example`, `docker-compose.yml`, `ci.yml` (×3), README. Decision:
   PostGIS was a d-round Phase 7 need. For a template use `postgres:18-alpine` (multi-arch, no
   Rosetta note needed) and make the image an env-driven default in all three runtime places.
   `{{DB_NAME}}` placeholder for the name.

8. **Web env is unvalidated.** `apps/web/lib/env.ts` should use the same `createEnv` pattern
   (browser-safe subset: `NEXT_PUBLIC_API_URL` with `z.url()`), read once in `next.config.ts` or a
   `lib/env.ts` that throws at build time on a bad value.

9. **Locale/brand in web.** `lang="ja"` in `apps/web/app/layout.tsx:23`, metadata title and
   description, header links in `app/(auth)/layout.tsx`, `components/app-shell.tsx`, `app/page.tsx`,
   copy in `features/auth/login-form.tsx:54`, dashboard "Phase 1 …" card.

10. **`.claude/*` docs after P0-3.** Regenerate the seed-account tables and migration names in
    `.claude/rules/migrations.md`, `.claude/skills/prisma/SKILL.md`; remove "Phase 2/7" remarks in
    `.claude/rules/{ui,repositories}.md`; check `.claude/agents/*.md` (already generic).

11. **CI hardening for reuse.** Parameterize image/DB via `env:` at the top of `ci.yml`; add
    `TURBO_TOKEN`/`TURBO_TEAM` (or `TURBO_REMOTE_CACHE_SIGNATURE_KEY`) as optional secrets with
    remote cache; add a `workflow_dispatch` trigger.

### P2 — nice to have

12. Remove unused deps: `bullmq` from `apps/worker/package.json` (re-export `UnrecoverableError`
    from `@repo/queue` if needed), `date-fns` from `packages/ui/package.json`, `@repo/logger` devDep
    from `packages/queue/package.json`.
13. `Dockerfile` for `apps/api`, `apps/worker`, `apps/web` (multi-stage, `yarn workspaces focus`)
    plus a `docker-compose.prod.yml`/profile — only if deployment targets are known.
14. `.github/PULL_REQUEST_TEMPLATE.md` (summary / test evidence / ADR links / AI attribution,
    mirroring `protocol.md` Step 6), `CODEOWNERS`, `renovate.json` or `dependabot.yml`.
15. Delete the empty `apps/web/hooks/` directory (untracked anyway); keep
    `packages/ui/src/hooks/README.md`.
16. Mark the GitHub repository as a _template repository_ so `gh repo create --template` works.

---

## 4. Files / values to parameterize

| Value                                                                 | Placeholder                                          | Where                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d-round` (package / compose / brand)                                 | `{{PROJECT_NAME}}`                                   | `package.json:2`, `docker-compose.yml:1`, `docker/pgadmin/entrypoint.sh:12`, `packages/auth/src/server.ts:40` (`appName`), `apps/web/app/layout.tsx:17`, `apps/web/app/page.tsx:14`, `apps/web/app/(auth)/layout.tsx:7`, `apps/web/components/app-shell.tsx:41`, `apps/web/features/auth/login-form.tsx:54`, `apps/worker/src/mail/templates.ts:33,37,44`, `apps/worker/test/env.test.ts:11`, `README.md:1` |
| "Form templates and approval workflows"                               | `{{PROJECT_DESCRIPTION}}`                            | `apps/web/app/layout.tsx:18`, `apps/web/app/page.tsx:16`, `CLAUDE.md:4`, `README.md:1-6`, `docs/adr/0001-stack.md:7`                                                                                                                                                                                                                                                                                        |
| `no-reply@d-round.local`                                              | `{{MAIL_FROM}}`                                      | `.env.example:37`, `README.md` env table                                                                                                                                                                                                                                                                                                                                                                    |
| `workflow` (database name)                                            | `{{DB_NAME}}`                                        | `.env.example:9,24`, `docker-compose.yml:14`, `docker/pgadmin/entrypoint.sh` (via env), `.github/workflows/ci.yml:29,37,53`, `README.md` psql example                                                                                                                                                                                                                                                       |
| `postgis/postgis:18-3.6`                                              | `{{POSTGRES_IMAGE}}`                                 | `docker-compose.yml:9`, `.github/workflows/ci.yml:25`, `packages/database/test/index.ts` default, `.claude/rules/testing.md`, `docs/conventions.md:349`, `README.md`                                                                                                                                                                                                                                        |
| `5433` / `6380` / `5050` / `1025` / `8025`                            | keep as defaults                                     | `.env.example`, `docker-compose.yml`; documented as "non-default on purpose" — keep, but mention in the init guide                                                                                                                                                                                                                                                                                          |
| `lang="ja"`                                                           | `{{HTML_LANG}}`                                      | `apps/web/app/layout.tsx:23`                                                                                                                                                                                                                                                                                                                                                                                |
| Roles `admin,hr_manager,dept_head,member`                             | template default `admin,member`                      | `packages/validation/src/user.schema.ts:6`, `packages/auth/src/access-control.ts`, `packages/permissions/src/rules.ts`, `packages/database/prisma/schema/auth/user.prisma:14`, `apps/web/features/users/role-badge.tsx`, docs                                                                                                                                                                               |
| Seed accounts (`*@test.com`, HR/Engineering, `EMP-000x`, `A12345678`) | `admin@test.com` + `member@test.com`, no departments | `packages/database/prisma/seed.ts`, `README.md`, `.claude/rules/migrations.md`, `.claude/skills/prisma/SKILL.md`                                                                                                                                                                                                                                                                                            |
| `BETTER_AUTH_SECRET=dev-only-…`                                       | keep dev value; guide says `openssl rand -base64 32` | `.env.example:33`                                                                                                                                                                                                                                                                                                                                                                                           |
| pgAdmin `admin@example.com` / `admin`                                 | keep (dev only)                                      | `.env.example`, `docker-compose.yml`                                                                                                                                                                                                                                                                                                                                                                        |
| Migration folder names `…_phase1_auth_outbox`                         | `0001_init`                                          | `packages/database/prisma/migrations/`, references in `.claude/rules/migrations.md:71`, `.claude/skills/{adr,prisma}/SKILL.md`, `docs/adr/{0002,0004}`                                                                                                                                                                                                                                                      |

---

## 5. Files / code / workspaces to delete (project-specific)

| Path                                                                                                                                                                                                     | Why                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `phase-0-1-claude-code-prompts.md`, `workflow-development-plan-v2.md`                                                                                                                                    | Mongolian d-round planning docs (mention `romuten-v3`); also drop their lines from `.prettierignore`                 |
| `docs/plans/phase-1-plan.md`                                                                                                                                                                             | d-round Phase 1 plan                                                                                                 |
| `packages/database/prisma/migrations/20260909113011_phase1_auth_outbox/`, `…_init/`                                                                                                                      | replaced by one squashed `0001_init` (P0-4)                                                                          |
| `User.employeeCode`, `User.department`, `@@index([department])`                                                                                                                                          | d-round fields (P0-3)                                                                                                |
| `employeeCodeSchema`, `departmentSchema`, `hr_manager`, `dept_head`                                                                                                                                      | `packages/validation/src/user.schema.ts`, `packages/auth/src/access-control.ts`, `packages/permissions/src/rules.ts` |
| `apps/web/features/users/user-picker-field.tsx`                                                                                                                                                          | only meaningful with departments; drop unless kept as a generic example of a Combobox field                          |
| Department / employee-code inputs in `register-form.tsx`, `profile-form.tsx`, `user-editor.tsx`, `users-table.tsx`                                                                                       | d-round profile shape                                                                                                |
| `.agents/`, `.claude/skills/{shadcn,prisma-cli,prisma-client-api,prisma-postgres,create-auth,better-auth-best-practices}` symlinks, `skills-lock.json`                                                   | untracked vendored skills — delete **or** commit + prettier-ignore (P0-1)                                            |
| `bullmq` (worker), `date-fns` (ui), `@repo/logger` (queue devDep)                                                                                                                                        | declared, never imported                                                                                             |
| `apps/web/hooks/`                                                                                                                                                                                        | empty directory                                                                                                      |
| Text: "Phase 1 ships user management…" (`apps/web/app/(app)/dashboard/page.tsx:45`), "Phase 2/7" remarks in `.claude/rules/{ui,repositories}.md`, `docs/adr/0001-stack.md:45`, `docs/conventions.md:349` | phase narrative                                                                                                      |

Nothing else is dead: every workspace is consumed, every `.claude/rules` file is path-scoped and
current, `docs/conventions.md` and the ADRs explain live decisions.

---

## 6. Proposed "New project from template" guide

```sh
# 0. Prerequisites: Node 24 (.nvmrc), Corepack, Docker Desktop
gh repo create my-app --template <org>/<template> --private --clone   # or: git clone … && rm -rf .git && git init
cd my-app
nvm use && corepack enable

# 1. Rename (one-shot script proposed in P0-2; until then: the sed list in §4)
node scripts/init-template.mjs --name my-app --db my_app --lang en \
  --description "My app" --mail-from "My app <no-reply@my-app.local>"

# 2. Environment
cp .env.example .env
#    set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#    change POSTGRES_PORT/REDIS_PORT if 5433/6380 clash with another stack (keep DATABASE_URL/REDIS_URL in sync)

# 3. Install (runs prisma generate + husky)
yarn

# 4. Infrastructure
yarn docker:up            # postgres, redis, mailpit, pgadmin — waits for health checks

# 5. Database
yarn db:migrate           # applies the single 0001_init migration
yarn db:seed              # admin@test.com + member@test.com, password A12345678

# 6. Run
yarn dev                  # web :3000, api :4000, worker; Mailpit UI :8025
#    sign in at http://localhost:3000/login as admin@test.com

# 7. Gate
yarn verify               # lint + typecheck + test (testcontainers → Docker) + build + format

# 8. First commit (Conventional Commits enforced by the commit-msg hook)
git add -A && git commit -m "chore: bootstrap from template"
git push -u origin main   # CI: migrations, schema drift, verify, commitlint

# 9. First feature: follow .claude/rules/module-template.md (schema → repository → service → router → tests)
```

---

## 7. Decisions needed before any change

1. Vendored skills (`.agents/`, `skills-lock.json`): commit + prettier-ignore, or delete?
2. Template domain: reduce roles to `admin` + `member` and drop `employeeCode`/`department`
   (recommended), or keep the four-role example as-is and only rename?
3. Postgres image: switch the template to `postgres:18-alpine` (recommended) or keep PostGIS?
4. Migrations: squash to one `0001_init` (recommended) or keep history?
5. Which of P1 6–11 and P2 12–16 to include in the first template pass?

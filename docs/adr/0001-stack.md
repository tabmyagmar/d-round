# 0001 — Foundation stack

Date: 2026-09-09

## Context

Greenfield form-template and approval-workflow system, single developer, single tenant. Phase 0
must deliver a runnable monorepo with tooling, conventions and agent orchestration before any
feature. The requirement is "latest stable of everything", pinned exactly, with incompatible pairs
resolved explicitly rather than silently downgraded.

## Decision

| Area             | Decision                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo         | Turborepo 2 + Yarn 4.14.1 (`nodeLinker: node-modules`, exact pins, `--immutable` in CI)                                                                                                                                       |
| Runtime          | Node 24 LTS (`.nvmrc`, `engines >=24 <25`)                                                                                                                                                                                    |
| Language         | TypeScript 6.0.3 — **not** 7.0                                                                                                                                                                                                |
| Lint and format  | ESLint 10.10 flat config, `typescript-eslint` strict, `eslint-plugin-import-x`, `@eslint-react/eslint-plugin`, `eslint-plugin-boundaries` 7 (`dependencies` rule), `eslint-plugin-unicorn`, `eslint-plugin-turbo`, Prettier 3 |
| Database         | PostgreSQL 18 via `postgis/postgis:18-3.6`; Prisma 7.10.0 with the `prisma-client` generator, `@prisma/adapter-pg` and `prisma.config.ts`                                                                                     |
| IDs              | UUID v7 primary keys (`@default(uuid(7)) @db.Uuid`)                                                                                                                                                                           |
| Queue            | BullMQ 6.3 + ioredis 6.0; Redis `redis:8-alpine`                                                                                                                                                                              |
| API              | Hono 4 + `@hono/node-server` 2 + tRPC 11 (`@trpc/tanstack-react-query` on the client)                                                                                                                                         |
| Web              | Next 16.3 (App Router) + React 19.2 + Tailwind 4.3 + shadcn CLI 4 (preset `b1Ymqvgiu`)                                                                                                                                        |
| Validation, logs | zod 4, pino 10                                                                                                                                                                                                                |
| Tests            | Vitest 5.0 (needs the `vite` peer) + testcontainers 12                                                                                                                                                                        |
| Build            | `tsdown` bundles `apps/api` and `apps/worker`; workspace packages are consumed as TypeScript source ("just-in-time packages")                                                                                                 |
| Tenancy          | Single tenant: Better Auth admin plugin + role field, no organization plugin                                                                                                                                                  |
| CI               | GitHub Actions: Postgres/Redis services → install → migrate → schema-drift check → `yarn verify` → commitlint                                                                                                                 |

Exact versions are pinned in the `package.json` files; this table records the majors and the
reasons.

## Alternatives

- **TypeScript 7.0** (native Go port): rejected for now — `typescript-eslint` 8.70 supports
  `>=6.0.0 <6.1.0` and type-aware linting is a hard requirement. Revisit when typescript-eslint
  supports 7.
- **`eslint-plugin-import` and `eslint-plugin-react`**: no ESLint 10 support; `import-x` and
  `@eslint-react` are the maintained equivalents.
- **Prisma 8.0**: release candidate only at decision time; 7.10 is the latest stable.
- **Yarn PnP**: Next.js, Prisma and several ESLint plugins still assume a `node_modules` tree.
- **Compiling workspace packages to `dist/`**: unnecessary — `tsdown` bundles the `@repo/*`
  sources into the two Node apps and Next.js transpiles them for the web app.
- **Plain `postgres` image**: PostGIS is needed in Phase 7; starting with `postgis/postgis` costs
  nothing now and avoids a later image swap and data migration.
- **Multi-tenant with the organization plugin**: not a requirement; it would put
  `organizationId` on every table and into every CASL condition.

## Consequences

- Type-aware lint, layer boundaries and Prettier run on every commit and in CI; the architecture
  is enforced by tooling, not by review.
- Prisma 7 specifics everywhere: no `url` in `schema.prisma`, driver adapter mandatory, generated
  client git-ignored and rebuilt by `yarn db:generate` / `postinstall`.
- BullMQ 6: ioredis is now an optional peer and is passed explicitly (RESP3 by default), the
  legacy `repeat` option is replaced by job schedulers, `UnrecoverableError` marks permanent
  failures.
- `postgis/postgis` is amd64-only: Apple Silicon runs it under Rosetta unless
  `POSTGRES_IMAGE=imresamu/postgis:18-3.6` and `POSTGRES_PLATFORM=linux/arm64` are set
  (`docs/conventions.md`).
- Exact pins make upgrades deliberate: `npm view <pkg> version`, ADR line for majors.
- To revisit: TypeScript 7 (when typescript-eslint supports it), Prisma 8 (when stable),
  Better Auth ↔ Prisma adapter compatibility at Phase 1.

## Status

Accepted (2026-09-09).

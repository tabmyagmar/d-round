# CLAUDE.md

## What this is
{{PROJECT_DESCRIPTION}}. Turborepo monorepo. See README for setup,
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
- `yarn verify` must be green before you declare a step done. Run it yourself per commit and
  read only the failures; the verifier agent runs once per MR.
- Prefer editing over adding. No new dependency without stating why and checking
  `npm view <pkg> version`. Use Context7 for library docs; do not rely on memory
  for Prisma, Better Auth, tRPC, BullMQ, shadcn APIs.
- Ported screen: read the legacy source (../d-round-web, ../d-round-api) and romuten-v3 before
  designing; the plan carries a `Legacy → new` table. A new web screen copies the shape of
  apps/web/features/users (skill feature-screen). Build only what the ticket or the legacy has.
- Simple over clever: a file reads top to bottom; no helper, hook or store without a second
  consumer; a choice that differs from the reference names its source (romuten-v3 path, legacy
  file, bulletproof-react) in the plan.
- A web step is done only after each changed screen was opened in the browser as every role it
  serves and compared with the legacy screen.
- Do not touch: prisma migrations already applied, .env files, CI secrets.
- Schema changes require an ADR note (docs/adr) and expand-contract safe migration.
- Commits: Conventional Commits. AI-assisted commits carry the attribution trailer
  defined in docs/conventions.md#ai-attribution.

## Style (enforced by ESLint/Prettier — fix lint, don't argue with it)
Arrow functions; kebab-case files with role suffix; no default exports except
Next.js/config; no `any`; type-only imports; import order by alias groups.

## Pointers
- protocol.md — planner/implementer/reviewer/verifier flow
- .claude/rules/ — path-scoped rules (auto-loaded); docs.md says which file owns each fact
- .claude/skills/ — how-to guides per library
- docs/adr/ — why decisions were made

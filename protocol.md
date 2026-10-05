# Orchestration protocol

Four roles. The main Claude Code session is the ORCHESTRATOR and delegates to
subagents defined in .claude/agents/. Roles never overlap in one turn.

## Roles
1. planner   (read-only)  — turns a ticket into a file-level plan with test list.
2. implementer            — executes ONE plan step at a time, TDD, runs checks.
3. reviewer  (read-only)  — reviews the diff against CLAUDE.md, .claude/rules,
                            and the plan; outputs a findings list, never edits.
4. verifier  (read-only + run) — runs `yarn verify` fresh, drift check, docker
                            smoke; reports pass/fail with logs. Never edits.

## Flow (per ticket / MR)
Step 0  Intake     Orchestrator restates the ticket, acceptance criteria, and
                   constraints. Asks the human ONLY for genuinely missing info.
Step 1  Plan       planner → plan.md in the ticket branch: commits, files to
                   touch, schema changes (flag!), tests to add, risks. Human
                   approves. Hard limits: ≤15 files per commit (an MR may hold
                   several commits); schema change ⇒ ADR line. Steps tagged
                   `[parallel: N]` touch disjoint files and may run at once.
Step 2  Implement  implementer executes plan steps in order (parallel groups
                   together). After each step: lint + typecheck + affected
                   tests. Stops on the first failure it cannot fix in 2
                   attempts and reports.
Step 3  Verify     Per commit the orchestrator runs `yarn verify` itself and
                   reads only the failures. The verifier agent runs once per
                   MR (last commit): `yarn verify` fresh (`--force`), the
                   schema drift gate when `prisma/schema` changed, docker
                   smoke when asked.
Step 4  Review     reviewer, per commit when the commit touches
                   `packages/database/prisma/schema`, `packages/auth`,
                   `packages/permissions` or `apps/api/src/trpc`; otherwise
                   once per plan unit. Checks: layer boundaries, error
                   handling via domain errors, CASL check present on every
                   non-public procedure, queue rules (ID-only, after-commit,
                   idempotent), tests exist and assert behavior not
                   implementation, naming, no secrets.
                   Output: BLOCKER / SHOULD / NIT list with file:line.
Step 5  Fix loop   implementer addresses BLOCKER+SHOULD (the orchestrator may
                   fix documentation itself); back to Step 3.
                   Budget: 2 rounds per reviewer↔implementer pair, then
                   escalate to the human with the open question.
Step 6  Close      Orchestrator writes the MR description (summary, test
                   evidence, ADR links, AI attribution), moves plan.md to
                   docs/plans/<date>-<ticket>.md, and records what slowed the
                   ticket down (a stalled agent, a stale rule, a missing
                   how-to) as a 1–3 line change to the agent or rule concerned.

## Reports
Every subagent ends with a handoff block and keeps the whole report under 40
lines; logs and long evidence stay in files the report points at.

    STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | PASS | FAIL
    OUTPUT: <changed files, or the findings / results table>
    NEXT: <what the orchestrator should do>

## Guardrails
- Subagents receive only the context they need (plan.md, relevant files).
- No subagent may run destructive git or DB commands (reset, drop, migrate reset).
- Any deviation from the approved plan requires re-approval; the orchestrator
  records accepted deviations as an amendment in plan.md.
- If tests are weakened or skipped to go green, the reviewer marks BLOCKER.
- When a subagent cannot be launched (permission denied, spend limit), the
  orchestrator may do that step itself under the same rules and says so in
  the commit message or the report.
- Before launching agents: no unrelated work in the tree (`git status` clean
  or stashed), the throwaway database is up when a migration is planned.

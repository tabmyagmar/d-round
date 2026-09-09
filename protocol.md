# Orchestration protocol

Four roles. The main Claude Code session is the ORCHESTRATOR and delegates to
subagents defined in .claude/agents/. Roles never overlap in one turn.

## Roles
1. planner   (read-only)  — turns a ticket into a file-level plan with test list.
2. implementer            — executes ONE plan step at a time, TDD, runs checks.
3. reviewer  (read-only)  — reviews the diff against CLAUDE.md, .claude/rules,
                            and the plan; outputs a findings list, never edits.
4. verifier  (read-only + run) — runs `yarn verify`, targeted tests, docker
                            smoke; reports pass/fail with logs. Never edits.

## Flow (per ticket / MR)
Step 0  Intake     Orchestrator restates the ticket, acceptance criteria, and
                   constraints. Asks the human ONLY for genuinely missing info.
Step 1  Plan       planner → plan.md in the ticket branch: files to touch,
                   schema changes (flag!), tests to add, risks. Human approves.
                   Hard limits: ≤15 files per MR; schema change ⇒ ADR line.
Step 2  Implement  implementer executes plan steps sequentially. After each step:
                   lint + typecheck + affected tests. Stops on the first failure
                   it cannot fix in 2 attempts and reports.
Step 3  Verify     verifier runs full `yarn verify` + integration tests.
Step 4  Review     reviewer checks: layer boundaries, error handling via domain
                   errors, CASL check present on every non-public procedure,
                   queue rules (ID-only, after-commit, idempotent), tests exist
                   and assert behavior not implementation, naming, no secrets.
                   Output: BLOCKER / SHOULD / NIT list with file:line.
Step 5  Fix loop   implementer addresses BLOCKER+SHOULD; back to Step 3.
                   Max 2 loops; then escalate to human.
Step 6  Close      Orchestrator writes MR description (summary, test evidence,
                   ADR links, AI attribution), updates docs if behavior changed.

## Guardrails
- Subagents receive only the context they need (plan.md, relevant files).
- No subagent may run destructive git or DB commands (reset, drop, migrate reset).
- Any deviation from the approved plan requires re-approval.
- If tests are weakened or skipped to go green, the reviewer marks BLOCKER.

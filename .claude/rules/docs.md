---
paths:
  - "**/*.md"
---

# Documentation — one home per fact

Every fact about the repository lives in exactly one file; every other file that needs it points
there. A change then touches one file, and a reviewer does not find stale copies.

| Fact                                                                  | Lives in                                         |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| Schema folders, migrations table, seed datasets                       | `.claude/rules/migrations.md`                    |
| Test accounts (emails, roles, password)                               | `.claude/rules/migrations.md` (seed section)     |
| Roles, actions, subjects, who may do what                             | `.claude/rules/permissions.md`                   |
| Layer contract and allowed imports                                    | `.claude/rules/layers.md`                        |
| Module file set and reference snippets                                | `.claude/rules/module-template.md`               |
| Test harnesses and testcontainers                                     | `.claude/rules/testing.md`                       |
| Why a decision was taken, and later changes to it                     | `docs/adr/NNNN-*.md` (`## Changes`, dated lines) |
| How auth behaves at runtime (sessions, devices, password links, gaps) | `docs/auth.md`                                   |
| Commands, ports, quick start, folder map (names)                      | `README.md`                                      |
| Library how-tos                                                       | `.claude/skills/<lib>/SKILL.md`                  |
| How a list, detail, create or update screen is built                  | `.claude/skills/feature-screen/SKILL.md`         |

Rules:

- A skill or README explains how to do something and names the rule file that holds the facts; it
  never repeats a list that changes per ticket (migrations, accounts, grants).
- The ADR keeps its original Decision text; a change is a new dated line under `## Changes` that
  says what it supersedes.
- Plans are per ticket: `plan.md` on the branch while the ticket is open, then
  `docs/plans/<date>-<ticket>.md` at Close.
- Prettier wraps prose at 100 columns (`proseWrap: always`); do not hand-wrap, and do not count line
  length in review.
- Reference a file by path, not by line number: line numbers go stale with the next commit.

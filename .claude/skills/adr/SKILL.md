---
name: adr
description: Use when a decision changes the schema, swaps or adds a dependency, or picks between architectural options that later work depends on.
---

# Architecture Decision Records

## Purpose

`docs/adr/` explains **why** the repo is the way it is, so nobody re-litigates a decision without
the original context. CLAUDE.md requires an ADR line for every schema change; this repo also
requires one for every dependency swap or major upgrade.

## When to write one

- Every schema change (a line in the module's ADR, or a new ADR for a new aggregate).
- Every dependency swap, major version jump or new runtime dependency.
- Any choice between alternatives that later code depends on (auth model, queue semantics,
  transport, tenancy).

Not for: refactors that keep behaviour, formatting, tooling knobs with obvious defaults.

## Template (5 lines minimum)

```markdown
# NNNN — <title>

Date: YYYY-MM-DD

- **Context**: what forced a decision (one or two sentences).
- **Decision**: what we do, stated as a rule.
- **Alternatives**: what we rejected and the one-line reason for each.
- **Consequences**: what becomes easier, what becomes harder, what must be revisited and when.
- **Status**: proposed | accepted | superseded by NNNN
```

## How-to

1. Next number: `ls docs/adr` → `NNNN-<kebab-title>.md` (`0001-stack.md` exists; Phase 1 adds
   `0002-auth.md`, `0003-permissions.md`, `0004-outbox.md`).
2. Write the five bullets; keep the whole file under one screen. Link related ADRs.
3. For a schema change inside an existing area, add a dated line under a `## Changes` heading of
   the existing ADR instead of a new file.
4. Reference the ADR in the MR description and, for schema changes, in the migration commit
   message.
5. Superseding: set the old status to `superseded by NNNN`; never delete an ADR.

<!-- Phase 1: add real example (0002-auth.md written alongside the Better Auth setup) -->

## Gotchas

- An ADR records a decision, not a design document — no code, no diagrams beyond a line or two.
- Write it in the same MR as the change; a later "docs" MR never happens.
- Dates use ISO format; the date is when the decision was made, not when the file was edited.

## Summary

<!-- What changes and why. Link the ticket. -->

## Test evidence

<!-- `yarn verify` output or the targeted commands you ran; screenshots for UI changes. -->

## Checklist

- [ ] Layer boundaries respected (transport → service → repository); domain errors, not TRPCError
- [ ] Every non-public procedure has an ability check; stateful rules live in the service
- [ ] Schema change → migration + ADR line (`docs/adr`); queue change → ID-only payload, after commit, idempotent
- [ ] Tests added or updated under `test/` (testcontainers for Postgres/Redis)
- [ ] Docs updated where behaviour changed (`README`, `.claude/rules`, `docs/`)

## ADRs

<!-- Links to new or amended decision records, or "none". -->

<!-- AI-assisted PRs end with: 🤖 Generated with [Claude Code](https://claude.com/claude-code) -->

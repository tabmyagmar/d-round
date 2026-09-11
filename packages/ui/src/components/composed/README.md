# components/composed

Domain-free components built from the shadcn primitives one level up: `StatusBadge`, `DataTable`
(`@tanstack/react-table` v9, server-side pagination) and `ConfirmDialog` (use instead of
`window.confirm`). A component starts in `apps/web/features/<feature>/` and moves here once it is
domain-free and reusable across apps; react-hook-form field wrappers live in `../form/` instead.
House style applies (arrow functions, kebab-case files, named exports). See `.claude/rules/ui.md`.

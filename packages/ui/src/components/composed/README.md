# components/composed

Domain-free components built from the shadcn primitives one level up: `StatusBadge`, `DataTable`
(`@tanstack/react-table` v9, server-side pagination), `ConfirmDialog` (use instead of
`window.confirm`), `PageHeader` (the page's `h1`, optional description and actions slot) and
`EmptyState` (the shadcn `Empty` with icon, an `h2` title, description and action; for placeholders,
403, 404 and error pages). `PageHeader` and `EmptyState` use no hooks, so server components render
them directly. A component starts in `apps/web/features/<feature>/` and moves here once it is
domain-free and reusable across apps; react-hook-form field wrappers live in `../form/` instead.
House style applies (arrow functions, kebab-case files, named exports). See `.claude/rules/ui.md`.

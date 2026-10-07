# components/composed

Domain-free components built from the shadcn primitives one level up, for every app and feature:

- Display: `StatusBadge`, `DataTable` (`@tanstack/react-table` v9, server-side paging and sorting,
  row selection; one card surface with its `PaginationBar`), `DescriptionList` (label / value
  pairs), `PageHeader`, `EmptyState`, `LoadingState`.
- Lists: `ListToolbar`, `SearchInput`, `FilterPopover` (fields rendered only while open),
  `FilterTags`, `OptionSelect` (also the base of the form `SelectField`), `RowActions`,
  `PaginationBar` (first / previous / pages / next / last and a page box), `SelectionBar`.
- Dialogs: `ContentDialog` (the shell; body mounted only while open) and `ConfirmDialog` on it (use
  instead of `window.confirm`).
- Choices: `GroupedCheckboxList` (labelled groups with select-all).

Defaults are English; apps pass their own labels. `PageHeader`, `EmptyState`, `LoadingState`,
`DescriptionList` and `ListToolbar` use no hooks, so server components render them directly. A
component starts in `apps/web/features/<feature>/` and moves here once it is domain-free and
reusable across apps; react-hook-form field wrappers live in `../form/` instead. House style applies
(arrow functions, kebab-case files, named exports). Props and references: `.claude/rules/ui.md`.

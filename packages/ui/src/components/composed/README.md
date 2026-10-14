# components/composed

Domain-free components built from the shadcn primitives one level up, for every app and feature:

- Display: `ContentCard` (every titled card; the title in the brand colour), `StatusBadge`,
  `DataTable` (`@tanstack/react-table` v9, server-side paging and sorting, row selection; one
  `ContentCard` whose header shows the title, the total and its `PaginationBar`), `DescriptionList`
  (label / value pairs), `PageHeader`, `EmptyState`, `LoadingState`.
- Lists: `ListToolbar`, `SearchInput`, `FilterPopover` (fields rendered only while open),
  `FilterTags`, `OptionSelect` (also the base of the form `SelectField`), `MultiOptionSelect` (the
  chips combobox, base of `MultiSelectField`), `CheckboxGroup` (base of `CheckboxGroupField`),
  `DateRangePicker` (a 期間 on the legacy calendar, base of `DateRangeField`), `RowActions`,
  `PaginationBar` (first / previous / pages / next / last and a page box).
- Pages: `StickyBar` (the action bar at the bottom of a page; holds a form's `FormActions`),
  `Stepper` (the steps of a multi-step form; `useStepper` in `../../hooks/` moves between them).
- Dialogs: `ContentDialog` (the shell; body mounted only while open), `ConfirmDialog` on it (use
  instead of `window.confirm`) and `ResponsiveDialog` (a `ContentDialog` from `md` up, a bottom
  `Drawer` below).
- Choices: `GroupedCheckboxList` (labelled groups with select-all).

Defaults are English; apps pass their own labels. `ContentCard`, `PageHeader`, `EmptyState`,
`LoadingState`, `DescriptionList`, `ListToolbar` and `Stepper` use no hooks, so server components
render them directly. A component starts in `apps/web/features/<feature>/` and moves here once it is
domain-free and reusable across apps; react-hook-form field wrappers and `FormActions` live in
`../form/` instead. House style applies (arrow functions, kebab-case files, named exports). Props
and references: `.claude/rules/ui.md`.

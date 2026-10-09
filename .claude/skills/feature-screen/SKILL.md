---
name: feature-screen
description:
  Use when adding a list, detail, create or update screen to apps/web, porting a legacy d-round-web
  screen, or deciding where a new UI piece belongs (feature folder, form field or composed
  component).
---

# Feature screens — copy `features/users`, do not redesign

`apps/web/features/users` is the reference implementation; the rules behind it are in
`.claude/rules/ui.md` (folders, URL state, lazy loading, composed components, forms). A new feature
copies its shape file by file. A choice that differs needs one line in the plan naming its source (a
romuten-v3 path, the legacy file, bulletproof-react), decided before the plan, not after a review
round.

## 1. Before the plan: the legacy screen

1. Read the legacy screen in `../d-round-web/src/features/<name>/` (columns, toolbar, filters,
   pagination, dialogs, form fields and their order, button placement) and the romuten-v3 equivalent
   when one exists.
2. Fill the plan's `## Legacy → new` table: every legacy piece is kept, changed or dropped, with the
   reason. The reviewer checks the screen against that table.
3. Build only what the table and the ticket contain. No extra bar, counter, transition or option.

## 2. List screen

- Container — `containers/users-container.tsx`: the query input is `parseSearchParams` over the
  list's zod schema from `@repo/validation`, `useSearch`, `useTableState`, the dialogs' target
  state.
- Table — `components/list/users-table.tsx`: `DataTable` is the card (`title`, total badge,
  `PaginationBar`), the columns, `RowActions`.
- Toolbar — `components/list/users-toolbar.tsx`: `ListToolbar` with `SearchInput`, `FilterPopover`,
  the actions, `FilterTags`.
- Filter fields — `components/list/user-filter.tsx` loads `user-filter-content.tsx` with
  `next/dynamic` inside the popover; data the fields need (the regions) is fetched by a small body
  component rendered only while the popover is open, so the content stays presentational. Several
  values per filter are list parameters (`?areas=EAST&areas=WEST`, an array in the list schema):
  `CheckboxGroup` for a few options, `MultiOptionSelect` for many, `HierarchyFilterFields`
  (`apps/web/components/source/`) for エリア / 地域 / 県名.
- Row menu — `components/list/user-row-actions.tsx`, actions filtered by ability.
- Labels and filter helpers (pure, node-tested) — `utils/user-labels.ts`, `utils/user-filters.ts`;
  router output types — `types.ts`.

Dialogs load with `next/dynamic` and render only while they have a target. Row selection and a
`stores/` zustand store exist only when a bulk action reads the selection. A status with more than
two values is changed in a `ConfirmDialog` holding the select
(`features/staff/components/staff-status-dialog.tsx`; the legacy changed it inside the row). A
dialog the list and the detail both open takes a callback for what follows (`StaffDeleteDialog`'s
`onDeleted`: the list unselects, the detail leaves); a list that must read its own selection renders
inside its `RowSelectionProvider` (`containers/staffs-container.tsx`).

## 3. Detail screen

The container (`containers/user-detail-container.tsx`) owns the queries and the dialogs; the
components under `components/detail/` are presentational: `DescriptionList` inside `ContentCard`s, a
toolbar with the actions the ability allows. A card some roles never see loads with `next/dynamic`.
A long legacy detail keeps its cards as components (`features/staff/components/detail/`); a card
showing another feature's data comes from that feature as a container the page hands in (the user
detail's 担当スタッフ, `.claude/rules/ui.md`).

## 4. Create and update screens

- Schema from `@repo/validation`; fields from `@repo/ui/components/form` in a `FieldGroup`; shared
  fields in `components/form/<name>-form-fields.tsx`; one thin form per mode, no `mode` prop.
- The form is presentational (`onSubmit`, `pending`); the container owns the mutation, the success
  toast and the redirect, and a failure is the query client's toast (`.claude/rules/ui.md`, Forms).
  Update sends only what changed.
- Actions: `FormActions` inside a `StickyBar` (`components/form/user-update-form.tsx`).
- A legacy modal stays a dialog: `ContentDialog` via `next/dynamic` owning the mutation, the same
  thin forms inside (`features/comment-templates/components/comment-template-dialog.tsx`).
- Tests render the form in `StrictMode` (`.claude/rules/testing.md`).
- A legacy stepped form is one form over one schema on the composed `Stepper` and `useStepper`
  (`features/staff/components/form/staff-form.tsx`): `utils/<name>-steps.ts` lists each step's
  fields (a test checks every schema field belongs to a step), 次へ is `goNext(trigger, guard)` with
  a legacy pre-check as the guard, the confirm step renders `getValues()` read-only, and create and
  edit share the form through props (title, defaults, labels), not a mode. The form wires the
  stepper's double-click guard (`.claude/rules/ui.md`, `Stepper`).
- Data that depends on the form's own values (the 担当者 of the chosen 地域) is looked up inside the
  form through a function the container passes (`findChargers`, `findAddress`), so the form stays
  testable without tRPC; a post code fills the address through `AddressFields`.
- A select that depends on another (地域 on エリア) is a `MultiSelectField` with `pruneToOptions`
  set once its data loaded (`HierarchyFields`); a uniqueness the legacy checked before saving
  (社員番号) is an `isEmployeeNumberFree`-style async prop the form awaits in its submit handler and
  reports with `setError` on the field.
- A single dependent select (one 地域 on one エリア) is a `SelectField` with `valueAs="number"` and
  `pruneToOptions`. A choice among another feature's rows (クライアント名 in the 就業先部署 form) is
  a domain picker (`.claude/rules/ui.md`, Domain pickers); a value that follows it (the
  next就業先番号) is a lookup the form runs once per choice, so a refetch never overwrites what the
  user typed since (`features/branches/components/form/branch-form.tsx`).

## 5. Before hand-over

1. `yarn verify` green.
2. Open every changed screen in the browser, signed in as each role it serves, next to the legacy
   screen: nothing missing, nothing extra; outline buttons and the search box visible on the page
   background; select-all, an untouched form's submit button, empty and error states behave.
3. Only then ask for review.

## 6. When a piece becomes reusable

A second screen needs it: move it to `packages/ui/src/components/composed/` (domain-free, English
defaults, a jsdom test) and import it from there. Until then it stays in the feature. The existing
composed components and form fields are listed in `.claude/rules/ui.md`.

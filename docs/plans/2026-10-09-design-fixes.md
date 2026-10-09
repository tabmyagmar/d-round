# Plan: Design fixes — date picker years, titled cards, menu icons, sidebar, logout confirm

Ticket: `feature/D_ROUND-TBD_design-fixes`, cut from `feature/D_ROUND-TBD_client-branch` (`da93eb0`)
because the clients and branches screens exist only there (one MR, seven commits after this plan,
each green on its own, ≤15 files). Status: **approved 2026-10-09** ("ok") with every decision below
as written. The plan lives at its closing path from the start: the root `plan.md` on this line of
history is the discord-alerts plan from the stray commit `78401e9`, and overwriting it would
conflict once that commit is dropped (a rebase of the client branch takes this branch along).

Read before this plan — legacy web (`d-round-web` `develop`, 2026-10-05):
`src/shared/components/core/InputDatePicker.tsx`, `core/Card.tsx`, `core/DialogAlert.tsx`,
`ui/dropdown-menu.tsx`, `table/rowActions.tsx`, `table/data-table.tsx`,
`layout/admin/sidebar/{app-sidebar,nav-main,nav-settings,items}.tsx`,
`layout/admin/header/{AuthUserAction,ProfileModals}.tsx`, `icons/{DoubleLeft,DoubleRight}.tsx`,
`features/{client,staff,user}/components/detail/*` (titles in `text-wb-900`); romuten-v3
`apps/web/src/components/common/ContentCard.tsx`; this repo: `.claude/rules/ui.md`, skill
`shadcn-ui`.

## Goal and acceptance criteria

The user's design review of 2026-10-09, seven points:

1. The date fields' calendar steps a year with `<<` / `>>` besides the month `<` / `>`.
2. Card titles stand apart from the content (bold or the brand colour, as the legacy); and the
   question "should Card be a composed component?" — yes (decision 2).
3. Menu item icons are coloured as in the legacy, not all black.
4. The table title stands apart the same way.
5. Sidebar rows a little larger with more space between them, the selected row as the legacy, a new
   icon for 定型文管理.
6. The collapse icon as the legacy.
7. ログアウト asks first.

Done when `yarn verify` is green per commit and every changed screen was opened in the browser as
the four roles (super_admin, admin, manager, am) next to the legacy code.

## Legacy → new

| #   | Legacy                                                                                                                                                                                                                                 | Before                                                                                                                    | New                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `InputDatePicker`: custom `Nav` `<<` `<` [year ▾ month ▾] `>` `>>`; `endMonth = maxDate ?? today + 50 years`                                                                                                                           | `<` [year ▾ month ▾] `>`; without `max` react-day-picker ends the dropdown at December of this year (no 入社日 next year) | `form/field-calendar.tsx`: `FieldCalendar` = `Calendar` + a `Nav` with year buttons (disabled at the bound, as the month buttons), dropdown caption, end month `max ?? +50 years`, 32 px cells so four buttons fit (the legacy size); `DateField`, `DateTimeField`, `DateRangeField` use it |
| 2   | `core/Card.tsx` `<Card title count actions>`: `CardTitle` 18 px semibold; detail titles `text-wb-900` (`ClientInfo`, `StaffInfo`, `UserStaffs`, `UserClients`, `StaffContact`, …)                                                      | 36 hand-built `Card` → `CardHeader` → `CardTitle` → `CardContent` in 17 files; title 16 px medium black, like the values  | composed `ContentCard` (`title`, `description`, `actions`, `children`, `className`, `contentClassName`); title 18 px semibold `text-primary` (the theme table maps `wb-900` to `primary`)                                                                                                   |
| 3   | `ui/dropdown-menu.tsx` colours item icons (`text-muted-foreground`), `rowActions` deletes in red; the user menu's icons are brand blue `#062C9B`, ログアウト red                                                                       | item icons inherit the black text (destructive red)                                                                       | local patch 7 in `dropdown-menu.tsx`: a default item's icon is `text-primary` unless it sets its own colour; destructive stays red; ログアウト becomes destructive                                                                                                                          |
| 4   | `table/data-table.tsx`: title 18 px bold with the total badge                                                                                                                                                                          | `DataTable` title 16 px medium black                                                                                      | `DataTable` renders its card through `ContentCard` (title + total badge, `PaginationBar` as `actions`): same title as 2                                                                                                                                                                     |
| 5   | `nav-main.tsx`: groups without side padding, `gap-1`; selected row `bg-selectedBg text-wb-900` with a 2 px `primary-900` bar on the right, square; sub rows with a 2 px left bar, selected `primary-900` + bold; 定型文管理 `Settings` | 32 px rows, no gap, rounded tint; sub rows tinted; 定型文管理 `FileText`                                                  | rows 40 px with 20 px icons and 4 px between them, full width; selected row tint + 2 px `sidebar-primary` bar on the right, square; sub rows 36 px with a 2 px left bar, selected `sidebar-primary` + bold; 定型文管理 `Settings` (the icon rail keeps 32 px squares)                       |
| 6   | `app-sidebar.tsx`: `DoubleLeft` (open) / `DoubleRight` (collapsed) in `#062C9B`                                                                                                                                                        | `SidebarTrigger` with `PanelLeft`                                                                                         | a ghost icon button with lucide `ChevronsLeft` / `ChevronsRight` in `text-primary`, named サイドバーを閉じる / サイドバーを開く                                                                                                                                                             |
| 7   | `ProfileModals.tsx`: `DialogAlert` ログアウト確認 / ログアウトしますか？ / はい / いいえ                                                                                                                                               | ログアウト signs out at once                                                                                              | `ConfirmDialog` (`next/dynamic`) with the same texts; `AppHeader` owns the sign-out and hands `onSignOut` to a presentational `UserMenu`                                                                                                                                                    |

Not changed (not asked): the sidebar width (legacy 204 px), the mobile header's sheet button, card
borders and shadows, the row menu's "…" trigger colour.

## Decisions

1. **Year buttons in the date fields, not in `calendar.tsx`.** The legacy put its year navigation in
   the field (`InputDatePicker`), and generated primitives stay pristine (`.claude/rules/ui.md`).
   `FieldCalendar` wraps `Calendar` for the three fields (three consumers). react-day-picker has no
   year labels: the buttons are named 前の年へ / 次の年へ when the calendar's locale is `ja` (its
   month labels are 前の月へ / 次の月へ), Previous year / Next year otherwise. A year button jumps
   through `useDayPicker().goToMonth`, which clamps to the start and end month.
2. **`ContentCard` instead of hand-built cards.** Legacy `core/Card.tsx` and romuten-v3
   `components/common/ContentCard.tsx` (59 feature consumers, none builds `CardTitle` itself) make a
   titled card one component; the name pairs with `ContentDialog`. Features stop assembling
   `CardHeader` / `CardTitle` (`AuthCard`, with its logo and large title, stays as it is). Cards
   without a title (the user forms, the profile form) stay plain `Card` + `CardContent`.
3. **Menu icon colour is a primitive patch.** One rule colours every menu (row menus and the user
   menu, and any later one), as `button.tsx` patch 6 did for outline buttons; documented as patch 7
   and pinned by a class test like `button.test.tsx`.
4. **Sidebar styling stays in `nav-main.tsx`.** The shadcn primitives are customised by `className`
   at the app level; `sidebar.tsx` is not patched.
5. **Sign-out lifted to `AppHeader`.** A presentational `UserMenu` (`onSignOut`) tests the confirm
   without mocking Better Auth or the Next router (`.claude/rules/testing.md`).

## Commits

1. `docs(plans)`: this plan.
2. `feat(ui)` date fields — `packages/ui/src/components/form/field-calendar.tsx` (new),
   `date-field.tsx`, `date-time-field.tsx`, `date-range-field.tsx`,
   `packages/ui/test/components/form/date-field.test.tsx` (new), `.claude/rules/ui.md`.
3. `feat(ui)` content card — `packages/ui/src/components/composed/content-card.tsx` (new),
   `composed/data-table.tsx`, `packages/ui/test/components/composed/content-card.test.tsx` (new),
   `composed/README.md`, `.claude/rules/ui.md`, `.claude/skills/feature-screen/SKILL.md`.
4. `refactor(web)` users, clients and branches cards —
   `features/users/components/detail/user-charges-placeholder.tsx`,
   `features/users/containers/{profile,user-detail}-container.tsx`,
   `features/clients/components/{form/client-basic-step,form/client-form-confirm,detail/client-info-card}.tsx`,
   `features/branches/components/{form/branch-basic-step,form/branch-form-confirm,detail/branch-detail}.tsx`.
5. `refactor(web)` staff cards — `features/staff/components/user-staffs-card.tsx`,
   `form/{staff-family-member-fields,staff-basic-step,staff-memo-fields,staff-form-confirm}.tsx`,
   `detail/{staff-contact-card,staff-info-card,staff-memos-card}.tsx`.
6. `feat(ui)` menu icons — `packages/ui/src/components/dropdown-menu.tsx`,
   `packages/ui/test/components/dropdown-menu.test.tsx` (new), `.claude/rules/ui.md`.
7. `feat(web)` sidebar — `apps/web/components/layout/{nav-main,app-sidebar}.tsx`,
   `apps/web/config/nav.ts`, `.claude/rules/ui.md`.
8. `feat(web)` logout — `apps/web/components/layout/{user-menu,app-header}.tsx`,
   `apps/web/test/components/layout/user-menu.test.tsx` (new).

## Tests

- `date-field.test.tsx`: `>>` / `<<` move the shown month a year; a year button is disabled at the
  bound; without `max` the calendar reaches next year.
- `content-card.test.tsx`: title, description, actions, the body; no header without a title or
  actions; the title in the brand colour. `data-table.test.tsx` keeps passing unchanged.
- `dropdown-menu.test.tsx`: a default item's icon takes `text-primary`; a destructive item's does
  not.
- `user-menu.test.tsx` (StrictMode): ログアウト opens ログアウト確認; いいえ closes it without
  signing out; はい calls `onSignOut`.
- Visual only, checked in the browser: sidebar sizes, selected bar, icons, collapse arrows, title
  colours, menu icons.

## Log

- 2026-10-09: plan approved ("ok").
- Implemented in seven commits (`36b2f34` date fields, `b6fc65d` ContentCard, `606441f` and
  `3046108` features on it, `27a4967` menu icons, `8cd1e31` sidebar, `83cf356` logout), each green
  on `yarn turbo run lint typecheck test test:scripts build format:check` with the main checkout's
  cache read-only (`--cache=local:r --cache-dir=<main>/.turbo/cache`, the disk is 98% full), and
  `eslint --max-warnings 0` on the changed files before every commit. Steps done by the orchestrator
  itself (small, sequential UI steps), as protocol.md allows.
- Amendments: `83cf356` also edits `.claude/rules/ui.md` (the shell's ログアウト sentence: the
  confirm and `AppHeader` owning the sign-out), a doc sync the plan's commit 8 did not list. The
  year buttons use `aria-disabled` (react-day-picker's own `Nav` does, so a focused button keeps the
  focus) rather than `disabled`; the default end month is a module constant (December fifty years
  ahead), as `@eslint-react/purity` rejects `new Date()` during render.
- Browser check (headless Chromium against this worktree's web on :3001 and API on :4001, the dev
  database): every changed screen as super_admin, admin, manager and am — users list/detail (manager
  and am get the 403 their grants give), staff list/detail/create, clients list/detail, branches
  list/detail/create, 定型文管理, 操作方法, profile, user update — no console errors. 生年月日 (max
  today): `<<` twice shows 2024, `>>` stops at 2026 and is then disabled; 入社日 (no max): `>>`
  reaches 2027, which the calendar could not show before. ログアウト: いいえ keeps the
  session, はい lands on `/login`. Mobile (390 px): the header button opens the sheet and « closes
  it. Menu icons brand blue, ログアウト and 削除 red; card and table titles semibold brand blue.
- Verifier (once for the MR): PASS — a fresh run of every task with no cache read or written
  (`--cache=local:,remote:`; turbo 2.10 rejects `--force` with `--cache`), 40/40 including the
  api/database/worker testcontainers suites; targeted ui and web tests; `eslint --max-warnings 0` on
  the 33 changed TypeScript files.
- Reviewer round 1: REQUEST_CHANGES, 0 BLOCKER, 1 SHOULD, 3 NIT. SHOULD: the logout dialog's pending
  state never reset after a failed sign-out and went beyond the legacy — removed, はい signs out as
  the legacy `onOk`. NITs: the one-caller `yearLabels` inlined, its English labels now
  react-day-picker's wording; the shadcn-ui skill pointed at ui.md's patch list and names
  ContentCard as the card deviation; this Log records the ui.md amendment above. Fixed in `564e154`
  (decision 1's English "Previous year / Next year" is now "Go to the Previous / Next Year").
- Reviewer round 2 (`564e154` only): APPROVE, every round-1 finding resolved, nothing new.
- Security reviewed by hand (no `origin/HEAD` for `/security-review` on this line): UI only, no new
  data flow or dependency; the sign-out calls moved from `UserMenu` to `AppHeader` unchanged.
- What slowed the ticket: the worktree's API first pointed at `.env.example`'s database name `app`;
  the dev database is `workflow` (recorded in the session memory, not in the repo, as `.env` is
  off-limits).

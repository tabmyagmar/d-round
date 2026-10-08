# Plan: Settings — 定型文管理 (comment templates) and 操作方法 (help)

Ticket: `feature/D_ROUND-TBD_settings` (one MR, six commits, each green on its own, ≤15 files).
Status: **approved 2026-10-08** with every decision below as written. Read before this plan — legacy
web: `d-round-web/src/features/setting/**`, `src/app/admin/settings/*`,
`src/shared/hooks/useCommentTemplates.tsx` and its two consumers
(`features/staff/components/form/StaffFormStep2.tsx`,
`features/workflow/components/memo/Shorts.tsx`), `src/shared/config/routes/settingRoutes.ts`,
`src/shared/lib/casl/buildAbility.ts`, `src/shared/components/content/Toolbar.tsx`; legacy API:
`d-round-api/src/database/schema/source/commentTemplate.prisma`,
`src/graphql/resolvers/setting/comment/{queries,mutations,helpers}.ts`,
`src/graphql/schema/comment.ts`, `src/utils/errors/settings-comment.ts`; structure reference:
romuten-v3 `apps/web/src/features/{help,settings}`; this repo: `apps/web/features/users` (skill
`feature-screen`).

## Goal and acceptance criteria

Port the two legacy 設定 screens. 定型文管理 (`/admin/settings/privacy`): a signed-in user keeps
personal comment templates — a title (`short`) that pastes a text (`content`) into a comment box —
tagged with the menus they are for. Templates are personal: every legacy query filtered
`createdBy = ctx.user.id`, so a user sees, edits and deletes only their
own. 操作方法 (`/admin/settings/help`): the guide-book download table.

- `/admin/settings/privacy`: toolbar (検索, 削除 of the selected rows, 新規作成); table with select
  boxes and the legacy columns 使用先メニュー / タイトル / 作成日 / row actions
  (定型文編集, 定型文削除), paged, search and page in the URL.
- 新規作成 / 定型文編集 open a dialog (legacy `Modal`): 使用先メニュー (one or more
  of ワークフロー承認画面用コメント, ワークフロー一覧用メモ, クライアント管理, スタッフ管理), タイトル (≤100), テキスト (≤1000).
  A second template with the same title for the same user is refused and the dialog says so. Delete
  asks 定型文を削除しますか？ for one row or for the selection.
- API `commentTemplate.list / create / update / deleteMany`: every procedure behind
  `requireAbility`, the service re-checks ownership on the row and lists filter in the database. A
  user can never read, change or delete another user's template (tested).
- `/admin/settings/help`: card ガイドブック with 資料 / バージョン / 更新日付 / ダウンロード from a
  static list; the PDF is served from `apps/web/public/help/` and is not versioned (decision 8).
- Every page keeps `<PageGuard route={routes.settings.…}>` at its root (`route-tree.test.ts`); the
  schema change has a migration and an ADR; `yarn verify` green per commit; both screens opened in
  the browser as `staff@test.com` and `admin@test.com` next to the legacy screens.

## Decisions (each names its reference; the user may override any of them at approval)

1. **Two features, not one `settings` feature.** `apps/web/features/comment-templates/` and
   `apps/web/features/help/`. A feature is a domain slice (bulletproof-react
   `docs/project-structure.md`); romuten-v3 keeps `features/help/` and `features/settings/` apart,
   and its `help` grew its own Q&A, videos and inquiry form. 設定 is a sidebar group
   (`config/nav.ts`), not a domain, and a `settings` feature holding only templates would be
   misnamed; the API module is `comment-template`, so web and API carry the same name. Alternative
   (the legacy shape `features/setting/components/{list,form,help}`): one feature with
   `components/comment-template/` and `components/help/` — rejected because the two screens share no
   component, store or type.
2. **One table, Postgres enum array.** `comment_templates` with `types comment_for[]` replaces the
   legacy `CommentTemplate` + `CommentTemplateType` join table, which existed only because MySQL has
   no arrays; the hook's filter becomes `types: { has: type }`. `status EnumGeneralStatus` and
   `updatedBy` are dropped: no legacy query or screen read `status`, and only the owner ever updates
   (`updatedBy` always equalled `createdBy`). Hard delete as the legacy (and the ticket) — a soft
   delete would need a partial unique index Prisma cannot express, for data nobody audits (the
   legacy audit logger has these mutations off). Owner relation `onDelete: Cascade`: templates are
   the user's personal data. ADR 0006.
3. **Ownership is the second hard-coded CASL rule.** The legacy granted `Settings_*` to every
   signed-in user outside the permission table ("personal, not administered" — `buildAbility.ts`).
   Here: `can(["create","read","update","delete"], "CommentTemplate", { createdBy: user.id })` after
   the grant loop in `rules.ts`, like the self rule on `User`; `CommentTemplate` joins
   `SUBJECT_NAMES` (the catalog test only requires catalog ⊂ typed list). Routers use
   `requireAbility(action, "CommentTemplate")` (true for every signed-in user, like `read User` for
   self), the service checks the row with `prismaCommentTemplateSubject(row)` and lists with
   `accessibleCommentTemplatesWhere(ctx.ability)` → `{ createdBy }`. Route access stays
   `"signed-in"` (`canUnscoped` is false for a conditional rule, and the legacy let everyone in).
   ADR 0003 `## Changes` line + spec rows in `ability.test.ts`.
4. **API surface: `list`, `create`, `update`, `deleteMany`.** List rows carry `content` (≤1000
   chars, ≤20 rows), so the edit dialog edits the row it has and the future picker reads the text
   without a second request → no `byId` (legacy `commentTemplate(id)` had no other reader). One
   confirm dialog deletes one row or the selection through `deleteMany` (1–50 ids), so the single
   `deleteCommentTemplate` has no consumer and is not ported. `list` takes `search`
   (タイトル・テキスト, as the legacy `OR`) and `type` (the hook's filter, decision 7). No sort (the
   legacy had none; `createdAt desc`). Duplicate title → `ConflictError` from the unique violation
   (`translateDatabaseError`, as `user.service.ts`), no pre-check query.
5. **Dialog form.** `ContentDialog` (`sm:max-w-md`, title テンプレート作成 / テンプレート編集),
   loaded with `next/dynamic` and rendered only while the container has a target
   (`{ mode: "create" } | { mode: "edit"; row }`). The dialog owns the create / update mutation, the
   toast (テンプレートを作成しました / 更新しました) and `invalidateQueries`
   (`user-status-dialog.tsx` precedent); the form is presentational (`defaultValues`, `onSubmit`,
   `pending`, `errorMessage`, `onCancel`) and tests in `StrictMode`. Fields: `CheckboxGroupField`
   for the four menus (ui.md: `z.array(z.enum)` with few options → checkbox group; the legacy
   multi-select carried the same four), `TextField` with `maxLength` 100, `TextareaField` rows 4
   `maxLength` 1000; `FormActions` with キャンセル as child, submit 作成 / 更新. A `CONFLICT` error
   shows 同じタイトルの定型文があります, anything else `error.message`.
6. **Selection store copied from `features/users/stores/`.** Here the second consumer exists on day
   one: the table writes `rowSelection`, the toolbar's 削除 reads it. Two identical stores is the
   second copy; the third list promotes a `createRowSelectionStore` helper (rule of three, noted in
   Risks).
7. **`useCommentTemplates` is not ported as a hook.** Assessment of
   `src/shared/hooks/useCommentTemplates.tsx`: the shared location was right (two consumers in two
   features), but (a) shared code imported a feature's generated GraphQL documents, an arrow from
   shared into a feature that bulletproof-react forbids; (b) it made two round trips — the list
   without `content`, then `getCommentContent(id)` network-only per click — for ≤10 rows of ≤1000
   chars; (c) `useMemo` over `data ?? []` and `fetchPolicy` juggling were Apollo noise; (d) both
   consumers repeated the same `map → <Button size="sm" variant="outline">{short}</Button>` block,
   so the reusable thing was a component, not the hook. On tRPC + React Query there is nothing for
   the hook to do: a consumer calls
   `useQuery(trpc.commentTemplate.list.queryOptions({ type, perPage: 10 }))` and reads `content`
   from the row (ui.md: tRPC hooks are called where used). This ticket ports its API side (`type`
   filter, `content` in rows, tested). The picker (`CommentTemplateShortcuts`: the buttons,
   `onPick(content)`) arrives with its first consumer (staff form or workflow memo) as an app-level
   component in `apps/web/components/` — features do not import each other (the shell's `RoleBadge`
   precedent). No consumer exists in this repo today, and CLAUDE.md allows no hook or component
   without one.
8. **Help PDF is not versioned.** The legacy `public/help/ガイドブック.pdf` is 73 MB; committing it
   bloats every clone forever and Git LFS is not set up. `apps/web/public/help/*.pdf` is git-ignored
   with a one-line README note (deployments place the file; developers copy it from the legacy
   checkout); the row links `/help/guidebook.pdf` (ASCII name, no URL-encoding surprises). The list
   itself is a static constant as romuten-v3's `features/help/data/guideVideos.ts`. Alternatives for
   the user: Git LFS, or an external URL through a `NEXT_PUBLIC_HELP_GUIDE_URL` in `lib/env.ts`.
9. **Routes and nav unchanged.** `routes.settings.privacy / help / manual` and the 設定 nav group
   already exist with the legacy titles; マニュアル stays `PlaceholderPage` (legacy: an empty page,
   not in the sidebar).
10. **Small deviations from the legacy, on purpose:** the toolbar's 削除 is disabled while nothing
    is selected instead of a warning toast (no dead click; the toast text stays for the success
    case); the table is `DataTable`'s card titled 全定型文数 with the total badge and pagination in
    its header (review round 3 of the user feature); `Suspense` / `ViewTransition` /
    `SkeletonListPage` and `router.refresh()` are not ported (user-feature decision 1:
    `DataTable isLoading` + `invalidateQueries`).

## Legacy → new

| Legacy piece (file)                                                                                           | New                                                                                                         | Kept / changed / dropped — why                                                                |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `CommentTemplate` + `CommentTemplateType` (MySQL join), `status`, `updatedBy`                                 | `comment_templates.types comment_for[]`, `created_by`, unique `(created_by, short)`                         | changed — decision 2                                                                          |
| `commentTemplates(where{search,type},take,skip)` → `{data,count}`                                             | `commentTemplate.list({ search?, type?, page, perPage })` → `PageResult`, rows with content                 | changed — repo pagination; `content` in rows (decision 4)                                     |
| `commentTemplate(id)`                                                                                         | —                                                                                                           | dropped — the dialog edits the row it has (decision 4)                                        |
| `createCommentTemplate`, `updateCommentTemplate` (full input)                                                 | `create`, `update` (`commentTemplateId` + any subset)                                                       | changed — update sends only what changed (feature-screen §4)                                  |
| `deleteCommentTemplate(id)`, `deleteCommentTemplates(ids)` (`≥50` refused)                                    | `deleteMany({ commentTemplateIds: 1–50 })`                                                                  | changed — one dialog, one mutation (decision 4)                                               |
| `COMMENT_TEMPLATE_NOT_FOUND / DUPLICATED / TOO_MANY` (Japanese GraphQL errors)                                | `NotFoundError`, `ForbiddenError` (another user's row), `ConflictError`; zod `max(50)`                      | changed — domain errors (`core/errors.ts`); the dialog shows the Japanese text for `CONFLICT` |
| `shield`: `authRequired`; `buildAbility`: `Settings_*` for everyone                                           | `requireAbility(action, "CommentTemplate")` + ownership rule                                                | changed — decision 3                                                                          |
| `settingRoutes.ts`, sidebar `items.tsx` (定型文管理, 操作方法)                                                | `routes.settings.*`, `nav.ts` 設定 group                                                                    | kept — already in place (decision 9)                                                          |
| `settings/privacy/page.tsx` (async server container, `Suspense`, `ViewTransition`)                            | `page.tsx` → `PageGuard` → `CommentTemplatesContainer` (client, `useQuery`)                                 | changed — decision 10; user-feature decision 1                                                |
| `CommentTemplatesToolbar`: `SearchInput` 検索, trash button (`useOnDelete`), 新規作成                         | `ListToolbar`: `SearchInput` (タイトル・テキストで検索), 削除 (disabled without selection), 新規作成        | kept; 削除 disabled instead of 定型文が選択されていません toast (decision 10)                 |
| `CommentTemplateColumns`: select, 使用先メニュー (labels joined), タイトル, 作成日 `YYYY/MM/DD`, actions      | `DataTable` rowSelection + the same four columns (`formatDate`), `RowActions`                               | kept — labels from `utils/comment-template-labels.ts`                                         |
| `RowActions` 定型文編集 / 定型文削除 (subject `Admin_Client`, a copy-paste)                                   | `CommentTemplateRowActions`, same two items, no ability filter                                              | changed — the list holds only the owner's rows; nothing to filter                             |
| `Modal` テンプレート作成 / 編集 + `CommentTemplateForm` (`lazy`, `useLazyQuery` by id)                        | `CommentTemplateDialog` (`next/dynamic`) + presentational `CommentTemplateForm`                             | changed — decision 5                                                                          |
| `FormMultiSelectField` 使用先メニューを選択, `FormInputField` タイトル, `FormTextAreaField` テキスト          | `CheckboxGroupField`, `TextField`, `TextareaField` (+ counters)                                             | changed — ui.md field table                                                                   |
| `schema/index.ts` (`createTemplateSchema`, Japanese messages)                                                 | `@repo/validation` `createCommentTemplateSchema` with the same messages and limits                          | kept — shared with the API                                                                    |
| `DialogAlert` 定型文を削除しますか？ ×2; toasts 定型文が削除されました / できませんでした                     | `CommentTemplateDeleteDialog` (`ConfirmDialog`, one for a row or the selection)                             | kept — one component instead of two                                                           |
| `store/index.ts` (`selectedItems` Map, `rowSelection`, `addDialogState`) + `context/`                         | `stores/comment-templates-store.ts` (`rowSelection` only) + provider; dialog target in container `useState` | changed — ui.md state order; `selectedItems` Map was `rowSelection` again                     |
| `hooks/useCommentTemplateVariables.ts`, `types/index.ts`                                                      | `parseSearchParams(listCommentTemplatesSchema)`, `types.ts` from `AppRouter`                                | changed — URL state through the API schema (ui.md)                                            |
| `useDeleteCommentTemplate(s)` hooks                                                                           | mutations inside `CommentTemplateDeleteDialog`                                                              | changed — one caller each (user-feature step 7)                                               |
| `shared/hooks/useCommentTemplates.tsx` (two consumers)                                                        | API: `list.type` + `content` in rows; picker component with its first consumer                              | changed / deferred — decision 7                                                               |
| `HelpContainer`: card ガイドブック, 資料 (File icon) / バージョン / 更新日付 / ダウンロード, 資料がありません | `HelpContainer` → `HelpGuideTable` over `HELP_GUIDES`; download as `<a href download>`                      | kept — pagination dropped (one row, `PaginationBar` shows nothing with one page anyway)       |
| `public/help/ガイドブック.pdf` (73 MB)                                                                        | `public/help/guidebook.pdf`, git-ignored                                                                    | changed — decision 8                                                                          |
| `settings/manual/page.tsx` (`<>ManualPage</>`)                                                                | `PlaceholderPage` as today                                                                                  | kept — nothing to port                                                                        |

## Schema changes

FLAG — new `packages/database/prisma/schema/setting/comment-template.prisma` (new area folder, as
`access/` and `source/`):

```prisma
enum CommentFor { WORKFLOW APPLICATION CLIENT STAFF  @@map("comment_for") }

model CommentTemplate {
  id        String       @id @default(uuid(7)) @db.Uuid
  createdBy String       @map("created_by") @db.Uuid
  types     CommentFor[]                      // legacy CommentTemplateType rows (MySQL had no arrays)
  short     String       @db.VarChar(100)      // タイトル
  content   String                             // テキスト (≤1000, enforced by zod)
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")
  owner     User         @relation(fields: [createdBy], references: [id], onDelete: Cascade)
  @@unique([createdBy, short])                 // legacy `my_comment`; also the index list queries use
  @@map("comment_templates")
}
```

`auth/user.prisma` gains the relation field `commentTemplates CommentTemplate[]` (no column — the
allowed kind of edit, as `permissions UserPermission[]`). Migration
`yarn db:migrate:dev --name add_comment_templates`: expand only (new enum, new table, FK). ADR: new
`docs/adr/0006-comment-templates.md` (Context / Decision / Alternatives / Consequences, the points
of decision 2) and one `## Changes` line in `docs/adr/0003-permissions.md` (decision 3). Dev
database 5433: apply with `yarn db:migrate` (deploy) so the running dev server keeps working
(`local-dev-environment` notes).

## Files to touch (one table per commit)

### Commit 1a — `feat(db): comment_templates table, repository and ADR 0006` (9)

| #   | File                                                                         | Action | Layer      | Purpose                                                                                                 |
| --- | ---------------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------- |
| 1   | docs/adr/0006-comment-templates.md                                           | create | docs       | decision 2 (first, before the migration — migrations.md workflow)                                       |
| 2   | packages/database/prisma/schema/setting/comment-template.prisma              | create | database   | enum + model above                                                                                      |
| 3   | packages/database/prisma/schema/auth/user.prisma                             | edit   | database   | `commentTemplates CommentTemplate[]`                                                                    |
| 4   | packages/database/prisma/migrations/<ts>_add_comment_templates/migration.sql | create | database   | generated, read before commit                                                                           |
| 5   | packages/database/src/index.ts                                               | edit   | database   | export `CommentFor` (value) and `CommentTemplate` (type)                                                |
| 6   | packages/database/src/repositories/comment-template.repository.ts            | create | repository | `findById`, `findMany(params, where)` (createdAt desc), `create`, `update`, `deleteMany(where)` → count |
| 7   | packages/database/src/repositories/index.ts                                  | edit   | repository | barrel                                                                                                  |
| 8   | packages/database/test/repositories/comment-template.repository.test.ts      | create | test       | rolled-back transaction, a `users` row created inside it for the FK                                     |
| 9   | .claude/rules/migrations.md                                                  | edit   | docs       | schema folder `setting/`, migrations table row (see Risks: `.claude` edits)                             |

### Commit 1b — `feat(permissions): personal CommentTemplate rule` (6)

| #   | File                                      | Action | Layer  | Purpose                                                                                                                                               |
| --- | ----------------------------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | packages/permissions/src/rules.ts         | edit   | shared | `"CommentTemplate"` in `SUBJECT_NAMES`; `CommentTemplateConditions = { createdBy?: string }`; `CanFn` conditions union; the rule after the grant loop |
| 2   | packages/permissions/src/ability.ts       | edit   | shared | `CommentTemplateSubject`, `commentTemplateSubject(record)`, `AppSubjects` union                                                                       |
| 3   | packages/permissions/src/server.ts        | edit   | shared | `ServerSubjects` with `CommentTemplate`, `prismaCommentTemplateSubject`, `accessibleCommentTemplatesWhere`                                            |
| 4   | packages/permissions/src/index.ts         | edit   | shared | exports                                                                                                                                               |
| 5   | packages/permissions/test/ability.test.ts | edit   | test   | spec rows (Tests table)                                                                                                                               |
| 6   | docs/adr/0003-permissions.md              | edit   | docs   | `## Changes` 2026-10-08 line                                                                                                                          |

### Commit 2 — `feat(api): commentTemplate module` (7)

| #   | File                                                                    | Action | Layer      | Purpose                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | packages/validation/src/comment-template.schema.ts                      | create | validation | `COMMENT_FOR`, `commentForSchema`, `createCommentTemplateSchema` (legacy messages), `updateCommentTemplateSchema` (`commentTemplateId` + partial), `deleteCommentTemplatesSchema` (1–50 ids), `listCommentTemplatesSchema` (`paginationSchema` + `search?` + `type?`), types |
| 2   | packages/validation/src/index.ts                                        | edit   | validation | re-export                                                                                                                                                                                                                                                                    |
| 3   | apps/api/src/modules/comment-template/comment-template.service.ts       | create | service    | `list`, `create`, `update`, `removeMany` (export names; `delete` is reserved) — decision 3 checks, `ConflictError` on unique violation                                                                                                                                       |
| 4   | apps/api/src/trpc/routers/comment-template.router.ts                    | create | transport  | `list`, `create`, `update`, `deleteMany`, each `requireAbility(…, "CommentTemplate")`                                                                                                                                                                                        |
| 5   | apps/api/src/trpc/router.ts                                             | edit   | transport  | `commentTemplate: commentTemplateRouter`                                                                                                                                                                                                                                     |
| 6   | apps/api/test/modules/comment-template/comment-template.service.test.ts | create | test       | Tests table                                                                                                                                                                                                                                                                  |
| 7   | apps/api/test/trpc/routers/comment-template.router.test.ts              | create | test       | Tests table                                                                                                                                                                                                                                                                  |

### Commit 3a — `feat(web): comment template form, dialogs, store and labels` (10)

| #   | File                                                                               | Action | Layer | Purpose                                                                                                   |
| --- | ---------------------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------- |
| 1   | apps/web/features/comment-templates/types.ts                                       | create | web   | `CommentTemplateRow` from `AppRouter`                                                                     |
| 2   | apps/web/features/comment-templates/utils/comment-template-labels.ts               | create | web   | `COMMENT_FOR_LABELS` (legacy `values.ts` jp), `COMMENT_FOR_OPTIONS`, `typesLabel(types)` (joined with 、) |
| 3   | apps/web/features/comment-templates/stores/comment-templates-store.ts              | create | web   | copy of `users-store.ts` (`rowSelection`)                                                                 |
| 4   | apps/web/features/comment-templates/stores/comment-templates-store-provider.tsx    | create | web   | copy of `users-store-provider.tsx`                                                                        |
| 5   | apps/web/features/comment-templates/components/comment-template-form.tsx           | create | web   | presentational form (decision 5)                                                                          |
| 6   | apps/web/features/comment-templates/components/comment-template-dialog.tsx         | create | web   | `ContentDialog` + mutations + toast (decision 5)                                                          |
| 7   | apps/web/features/comment-templates/components/comment-template-delete-dialog.tsx  | create | web   | `ConfirmDialog` + `deleteMany` + toasts                                                                   |
| 8   | apps/web/test/features/comment-templates/utils/comment-template-labels.test.ts     | create | test  | node                                                                                                      |
| 9   | apps/web/test/features/comment-templates/stores/comment-templates-store.test.ts    | create | test  | node                                                                                                      |
| 10  | apps/web/test/features/comment-templates/components/comment-template-form.test.tsx | create | test  | jsdom, `StrictMode`                                                                                       |

### Commit 3b — `feat(web): 定型文管理 list on /admin/settings/privacy` (7)

| #   | File                                                                                   | Action | Layer | Purpose                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | apps/web/features/comment-templates/containers/comment-templates-container.tsx         | create | web   | URL → `parseSearchParams(listCommentTemplatesSchema)` → `useQuery` (`keepPreviousData`); store provider; dialog targets; `next/dynamic` dialogs |
| 2   | apps/web/features/comment-templates/components/comment-templates-table.tsx             | create | web   | `DataTable` 全定型文数, rowSelection, four columns, `RowActions`                                                                                |
| 3   | apps/web/features/comment-templates/components/comment-templates-toolbar.tsx           | create | web   | `ListToolbar`: `SearchInput`, 削除 (destructive outline, `disabled={selectedCount === 0}`), 新規作成                                            |
| 4   | apps/web/features/comment-templates/components/comment-template-row-actions.tsx        | create | web   | 定型文編集 / 定型文削除 (destructive)                                                                                                           |
| 5   | apps/web/app/admin/settings/privacy/page.tsx                                           | edit   | web   | `PlaceholderPage` → `CommentTemplatesContainer`, `PageGuard` kept                                                                               |
| 6   | apps/web/test/features/comment-templates/components/comment-templates-table.test.tsx   | create | test  | jsdom                                                                                                                                           |
| 7   | apps/web/test/features/comment-templates/components/comment-templates-toolbar.test.tsx | create | test  | jsdom                                                                                                                                           |

### Commit 4 — `feat(web): 操作方法 guide-book table on /admin/settings/help` `[parallel: A]` (7)

| #   | File                                                             | Action | Layer | Purpose                                                                                                                                                                       |
| --- | ---------------------------------------------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | apps/web/features/help/utils/help-guides.ts                      | create | web   | `HelpGuide` type, `HELP_GUIDES` (`DROUNDガイド`, v1, 2025/12/22, `/help/guidebook.pdf`)                                                                                       |
| 2   | apps/web/features/help/components/help-guide-table.tsx           | create | web   | `DataTable` ガイドブック: 資料 (File icon), バージョン, 更新日付, ダウンロード (`Button render={<a href download target="_blank" rel="noopener" />}`), empty 資料がありません |
| 3   | apps/web/features/help/containers/help-container.tsx             | create | web   | renders the table over `HELP_GUIDES`                                                                                                                                          |
| 4   | apps/web/app/admin/settings/help/page.tsx                        | edit   | web   | `PlaceholderPage` → `HelpContainer`, `PageGuard` kept                                                                                                                         |
| 5   | .gitignore                                                       | edit   | repo  | `apps/web/public/help/*.pdf`                                                                                                                                                  |
| 6   | README.md                                                        | edit   | docs  | one line: static documents under `apps/web/public/help/` are deployed, not versioned                                                                                          |
| 7   | apps/web/test/features/help/components/help-guide-table.test.tsx | create | test  | jsdom: the row, the link's `href`                                                                                                                                             |

### Commit 5 — `docs: comment templates and help features, personal rule` (≤5)

`.claude/rules/ui.md` (feature list and the two-features note; `features/comment-templates` as the
dialog-form reference), `.claude/rules/permissions.md` (the second hard-coded rule, the subject
list, "personal subjects keep `access: \"signed-in\"`"), `.claude/skills/feature-screen/SKILL.md`
(one line: create / edit in a dialog when the legacy used a modal), `plan.md` →
`docs/plans/2026-10-08-settings.md` at Close. `.claude/*` edits need the user out of auto mode
(Risks).

## Tests to add or update

| Test file                                                                              | Kind        | Asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/database/test/repositories/comment-template.repository.test.ts                | integration | `create` stores `types` as given and `findById` returns them; `findMany` pages newest first and `where` with `types: { has }` filters; the unique `(createdBy, short)` violation surfaces (`isUniqueViolation`) while another owner may reuse the title; `deleteMany(where)` returns the count and leaves other rows                                                                                                                                             |
| packages/permissions/test/ability.test.ts                                              | unit        | with no grants a user may `create / read / update / delete` `commentTemplateSubject({ createdBy: me })` and nothing on another owner's row; `canUnscoped(read, "CommentTemplate")` is false; `accessibleCommentTemplatesWhere` equals `{ createdBy: me }` and the prisma ability answers like the browser one; the typed lists accept the catalog (unchanged)                                                                                                    |
| apps/api/test/modules/comment-template/comment-template.service.test.ts                | integration | `create` sets `createdBy` to the caller and ignores any other id; a second template with the same title → `ConflictError`, the same title by another user succeeds; `list` returns only the caller's rows, `search` matches title and text, `type` filters; `update` of another user's row → `ForbiddenError`, unknown id → `NotFoundError`, renaming onto an existing title → `ConflictError`; `removeMany` deletes only the caller's ids and reports the count |
| apps/api/test/trpc/routers/comment-template.router.test.ts                             | integration | anonymous → `UNAUTHORIZED`; a staff user passes `requireAbility` for all four; `update` on another user's row → `FORBIDDEN`; 51 ids → `BAD_REQUEST`; `create` with empty `types` → `BAD_REQUEST`                                                                                                                                                                                                                                                                 |
| apps/web/test/features/comment-templates/utils/comment-template-labels.test.ts         | unit        | the four legacy labels; `typesLabel` joins in catalog order                                                                                                                                                                                                                                                                                                                                                                                                      |
| apps/web/test/features/comment-templates/stores/comment-templates-store.test.ts        | unit        | as `users-store.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| apps/web/test/features/comment-templates/components/comment-template-form.test.tsx     | jsdom       | `StrictMode`; labels 使用先メニュー / タイトル / テキスト; an untouched edit form keeps 更新 disabled; submitting with no menu shows 使用先メニューを選択してください; `onSubmit` receives `{ types, short, content }`; `errorMessage` renders; キャンセル calls `onCancel`                                                                                                                                                                                      |
| apps/web/test/features/comment-templates/components/comment-templates-table.test.tsx   | jsdom       | headers 使用先メニュー / タイトル / 作成日 in order; a row shows the joined labels and `YYYY/MM/DD`; the row menu offers 定型文編集 and 定型文削除                                                                                                                                                                                                                                                                                                               |
| apps/web/test/features/comment-templates/components/comment-templates-toolbar.test.tsx | jsdom       | 削除 disabled with no selection, enabled with one; 新規作成 calls `onCreate`; typing calls `onChange({ search })`                                                                                                                                                                                                                                                                                                                                                |
| apps/web/test/features/help/components/help-guide-table.test.tsx                       | jsdom       | one row with 資料 / バージョン / 更新日付; the ダウンロード link points at `/help/guidebook.pdf`                                                                                                                                                                                                                                                                                                                                                                 |
| apps/web/test/app/route-tree.test.ts, test/config/routes.test.ts                       | existing    | still green (pages keep `PageGuard`, routes unchanged)                                                                                                                                                                                                                                                                                                                                                                                                           |

## Steps (in order; `[parallel: A]` = commit 4 beside 3a / 3b)

### Step 1a — table, repository, ADR 0006

- Files: commit 1a. Test first: the repository test (red: no model). Then ADR 0006, schema files,
  `yarn db:migrate:dev --name add_comment_templates` against the throwaway database, read the SQL,
  `yarn db:generate`, exports, repository, barrel. Confirm scalar enum lists and the `has` filter
  with Context7 (Prisma 7, `prisma-client` generator) before writing the repository.
- Check: `yarn workspace @repo/database test`, `yarn lint`, `yarn typecheck`.

### Step 1b — personal rule

- Files: commit 1b. Test first: the spec rows (red: unknown subject). Then `rules.ts`, `ability.ts`,
  `server.ts`, `index.ts`, ADR 0003 line. Confirm `Subjects<{ … }>` with two models and
  `accessibleBy(…).ofType("CommentTemplate")` against `@casl/prisma` docs (Context7).
- Check: `yarn workspace @repo/permissions test`, `yarn workspace @repo/api test`
  (`permission-catalog.test.ts` must stay green), `yarn lint`, `yarn typecheck`.

### Step 2 — API module

- Files: commit 2. Test first: service and router tests (red: no module). Then schema, service,
  router, registration. `apps/web` typechecks against the new `AppRouter`.
- Check: `yarn workspace @repo/api test`, `yarn lint`, `yarn typecheck`.

### Step 3a — form, dialogs, store, labels

- Files: commit 3a. Test first: labels, store, form (jsdom). Then the components. Nothing renders in
  a page yet; the build stays green.
- Check: `yarn workspace @repo/web test`, `yarn lint`, `yarn typecheck`.

### Step 3b — the list screen

- Files: commit 3b. Test first: table and toolbar (jsdom, presentational props). Then container and
  page. Browser: `staff@test.com` and `admin@test.com` on `/admin/settings/privacy` next to the
  legacy screen — create, duplicate title, search, edit, delete one, select two and 削除, another
  account's templates invisible; outline buttons and the search box visible on the page background;
  select-all; an untouched edit form keeps 更新 disabled; empty state.
- Check: `yarn workspace @repo/web test`, `yarn lint`, `yarn typecheck`, `yarn verify`.

### Step 4 — help page `[parallel: A]`

- Files: commit 4. Test first: the table. Then the constant, container, page, `.gitignore`, README
  line; copy `../d-round-web/public/help/ガイドブック.pdf` to `apps/web/public/help/guidebook.pdf`
  locally (not committed). Browser: both roles on `/admin/settings/help`, the download opens.
- Check: `yarn workspace @repo/web test`, `yarn lint`, `yarn typecheck`.

### Step 5 — docs

- Files: commit 5 (after the user leaves auto mode for the `.claude/*` files, or the user applies
  them). Then protocol Step 6: `/security-review`, MR description, plan to `docs/plans/`.

## Risks and open questions

- **Auto mode denies `.claude/*` edits** (`agent-permissions` note): commit 1a's `migrations.md` row
  and commit 5 wait for the user to switch mode or apply them; the code commits do not depend on
  them.
- **Prisma enum arrays on the `prisma-client` generator + `@prisma/adapter-pg`**: supported on
  Postgres, but the generated TypeScript shape (`CommentFor[]`) and the `has` filter are confirmed
  with Context7 in step 1a before the repository is written; fallback is the legacy join table (one
  more model, `include`, and `some` filters).
- **`@casl/prisma` with a second model**:
  `Subjects<{ User: User; CommentTemplate: CommentTemplate }>` and `createPrismaAbility` conditions
  on `createdBy` must type-check with the existing `CanFn` (conditions become
  `UserConditions | CommentTemplateConditions`); if the union fights the builder, `CanFn` takes a
  per-subject conditions map. Confirmed in step 1b first.
- **Help PDF (73 MB)**: decision 8 keeps it out of git; the user may prefer Git LFS or an external
  URL. Until a deployment places the file, 操作方法 shows a working row whose download 404s on a
  checkout without the copy.
- **Repository test needs a `users` row** for the FK: created inside the rolled-back transaction
  (`inRolledBackTransaction`, `permission.repository.test.ts`) with a random email; the seed tests'
  exact counts stay untouched.
- **Two identical selection stores** (users, comment templates): accepted as the second copy; the
  third list (client / staff / branch) extracts `createRowSelectionStore` + a provider factory.
- **Japanese error text**: domain errors stay English (repo convention); the dialog maps `CONFLICT`
  to 同じタイトルの定型文があります. A general error-code → label map is a later, cross-feature
  ticket.
- The dev database on 5433 must receive the migration with `yarn db:migrate` (deploy), never
  `migrate dev`, so the running dev server keeps working (`local-dev-environment`).

## Out of scope

- The template picker (`CommentTemplateShortcuts`) and its consumers (staff memo form, workflow
  approval comment) — with the staff / workflow tickets (decision 7).
- マニュアル page content (legacy: empty), help Q&A / videos / inquiry form (romuten-v3 only).
- CSV, sorting, a `status` on templates, admin access to other users' templates, audit log rows.
- Git LFS or object storage for static documents (decision 8 alternatives).

## Log

- 2026-10-08 — plan drafted (planner role done inline: auto mode denies subagent launches).
- 2026-10-08 — approved by the user ("heregjuul") with every decision as written, including the
  git-ignored help PDF and the two features.
- 2026-10-08, branch: commit `3d96ba2` (`permissions.defaultMode: "auto"` in
  `.claude/settings.json`, made by the user in another session) sits on this branch and ships with
  the MR.
- 2026-10-08, step 1a: `migrations.md` also gained the missing `20261007000000_add_user_name_parts`
  row. The migration was generated read-only with `prisma migrate diff` against the dev database (in
  sync) and applied there with `migrate deploy`, so the running dev server kept working.
- 2026-10-08, step 1b: CASL types rule conditions per literal subject; a `CanFn` callback over every
  subject gets the union of `id` and `createdBy`, which no single subject shares, so the browser
  builder widens the conditions to `MongoQuery` with a comment. A generic `CanFn` was tried and
  broke CASL's action inference in both builders.
- 2026-10-08, step 2: the delete limit stays 50 (the legacy refused `>= 50`, read as an off-by-one).
  The service and router tests were written before the module but not run red on their own.
- 2026-10-08, step 3a: two thin forms (`comment-template-create-form`, `-update-form`) over
  `comment-template-fields` instead of one form with defaults, as the `feature-screen` skill says
  (no mode prop); the update form computes the changes inline (no `form-input` util: one consumer).
  Thirteen files instead of ten.
- 2026-10-08, step 3b: the delete dialog clears the deleted ids from the list's store itself (it
  always renders inside the provider) instead of an `onDone` prop. Browser check (headless
  Playwright against the running dev server, staff and admin): every scenario of the step passed;
  the only console entries were the 409 of the deliberate duplicate title. Difference left: the
  legacy modal centred its title, `ContentDialog` aligns it left as every other dialog here.
- 2026-10-08, step 4: Base UI keeps `role="button"` on the download `<a>`; the help container is a
  server component (static list), the table a client component.

---
name: nextjs
description:
  Use when adding a page, layout or route to apps/web, deciding between server and client
  components, wiring tRPC and React Query, reading the session, or building a form.
---

# Next.js 16 (App Router) in apps/web

`apps/web` is a Next.js 16 App Router app (React 19, Tailwind v4) that talks to `apps/api` over tRPC
and to Better Auth over `/api/auth`. It never touches the database or the queue. Rules:
`.claude/rules/ui.md` (components, forms, promotion to `packages/ui`), `.claude/rules/layers.md`.

## Layout of the app (no `src/`)

The folder map is in `README.md` (the `apps/web` entry); where each kind of component lives is in
`.claude/rules/ui.md` (Where components live). The files a page change usually touches:
`config/routes.ts` (the route catalog), `app/admin/<path>/page.tsx`, `features/<feature>/`,
`config/nav.ts` and, for access, `lib/auth/route-access.ts`.

## Server vs client components

| Need                                                 | Component type                                     |
| ---------------------------------------------------- | -------------------------------------------------- |
| Layout, page shell, static content                   | server (default)                                   |
| Read the session, redirect when signed out           | server (`proxy.ts` + `getCurrentUser` in a layout) |
| Data that can be fetched on the server               | server                                             |
| Forms, buttons with handlers, `useState`, tRPC hooks | client (`"use client"` at the leaf)                |

Route-file imports, the feature layout, default exports and the client-boundary rules are in
`.claude/rules/ui.md` (Where components live; Server vs client components). Example:
`app/admin/master/user/page.tsx` is a server page rendering the client
`features/users/containers/users-container.tsx`. A server component may import a value from a client
module only to render it — never call or dot into it (a shared constant lives in a module without
`"use client"`).

## Adding a page

1. Add the route to `config/routes.ts`: `{ path, title, access }`; `access` is `"public"`,
   `"signed-in"` or `{ action, subject }` (`read` for list and detail, `create`, `update`).
2. Create `app/admin/<path>/page.tsx` (default export) rendering the feature component (or
   `PlaceholderPage`) inside `<PageGuard route={routes.x.y}>` with that same route.
3. Top-level list pages get a `NavLeaf` (or a `NavBranch` child) in `config/nav.ts`.
4. Link to it with `href(routes.x.y, { id })`, never a string literal.

Steps 1 and 2 are enforced by `test/app/route-tree.test.ts`, the access rule behind them is in
`.claude/rules/permissions.md` (Web), and the shell and page chrome in `.claude/rules/ui.md` (Pages,
the route catalog and the sidebar).

## Session and authorization in the web

The four layers (proxy cookie check, `app/admin/layout.tsx`, `PageGuard`, the API) are described in
`.claude/rules/ui.md` (Authentication in the web app); the access rule in
`.claude/rules/permissions.md` (Web). In code:

- Server code reads the user with `getCurrentUser()` (`lib/auth/server.ts`; React `cache()`, so the
  layout and every `PageGuard` share one `/api/auth/get-session` fetch per request).
- `CurrentUser` carries `id`, `role` and the session's `permissions`, so it satisfies `AbilityUser`:
  `defineAbilityFor(user)` on the server, `useAbility()` under `AbilityProvider` in client
  components. Never a role literal in the web.
- A `?next=` value goes through `safeNextPath` before it is used.
- Sign-out: `authClient.signOut()` then `router.push(href(routes.auth.login)); router.refresh()`.

## tRPC + React Query

`lib/trpc/react.tsx` exports `TRPCProvider`, `useTRPC`, `useTRPCClient` from
`createTRPCContext<AppRouter>()` (`AppRouter` type-only from `@repo/api/router`);
`TRPCReactProvider` creates one `QueryClient` and one client (`httpBatchLink`, `superjson`,
`credentials: "include"`). In components: `useQuery(trpc.user.list.queryOptions(...))`,
`useMutation(trpc.user.updateProfile.mutationOptions(...))`,
`queryClient.invalidateQueries(trpc.user.pathFilter())` — details in the `trpc` skill.
`features/users/containers/users-container.tsx` is the list example: filters, page and sort in the
URL (`useSearch`, `parseSearchParams(listUsersSchema, searchParams)`, `useTableState` from
`apps/web/hooks/`; `.claude/rules/ui.md`, List pages), `DataTable` with server-side sorting and
pagination from `PageResult`, `keepPreviousData` while paging; the filter fields and the status
dialog load with `next/dynamic` only when used (`.claude/rules/ui.md`, Load only what the page
shows). `features/users/components/user-status-dialog.tsx` is the mutation example (`ConfirmDialog`
before deactivating, never `window.confirm`). A feature is split into `containers/` (what a route
renders), `components/`, `hooks/`, `utils/` and `types.ts` (`.claude/rules/ui.md`, Where components
live).

## Forms

`react-hook-form` + `zodResolver(schema)` with the schema from `@repo/validation` — the same schema
the API validates with. Inputs are the bound fields from `@repo/ui/components/form` (`TextField`,
`PasswordField`, `SelectField`, `ComboboxField`, `DateField`, ...; the full table and the zod-shape
mapping are in `.claude/rules/ui.md`, Forms) inside a `FieldGroup`; never hand-write `Field` /
`FieldLabel` / `Input` / `FieldError` for a standard input. Auth forms submit through `authClient`
(`features/auth/login-form.tsx`: `signIn.email` with `callbackURL: next` and `rememberMe`; errors
through `authErrorMessage`), everything else through a tRPC mutation
(`features/users/components/profile-form.tsx` on `/admin/profile`; the presentational
`features/users/components/user-create-form.tsx` and `user-update-form.tsx` over the shared
`user-form-fields.tsx`, whose containers own the mutations; `emptyAs="null"` on optional nullable
fields). Show server errors in an `Alert`; use `toast` (sonner) for mutation results. Domain pickers
live in the feature that owns the data (a user picker wraps `ComboboxField` with `trpc.user.list`
search). There is no register form: public sign-up is disabled (ADR 0002); users are invited
(`user.invite`) and set their first password on `/new-password`. Password flows: skill
`better-auth`.

## Env

Only `NEXT_PUBLIC_*` variables reach the browser (`NEXT_PUBLIC_API_URL`, read through `lib/env.ts`
with `createEnv`, which throws at build/load time on a malformed value); they are inlined at build
time, so reference them as `process.env.NEXT_PUBLIC_X` literally. Everything else stays on the
server.

## Gotchas

- Yarn 4 with `nodeLinker: node-modules` is required (`.yarnrc.yml`); PnP breaks Next.js.
- `apps/web` may import `@repo/api` types only; `@repo/database`, `@repo/queue`, `@repo/logger`,
  `@repo/permissions/server` and the `@repo/auth` server entry are lint-forbidden in the web element
  (use `@repo/permissions`, `@repo/permissions/react`, `@repo/auth/client`).
- `superjson` must be configured on both the server (`init.ts`) and the client link, or dates break.
- Server components read the session with `getServerSession` and leave tRPC data fetching to client
  components; never call the browser tRPC client from a server component.
- After a verification link is clicked, Better Auth signs the user in and redirects to the
  `callbackURL` passed to `sendVerificationEmail` (the resend form passes `LANDING_ROUTE`); the
  login form passes `next` as `callbackURL`.
- Tests: `apps/web/test` runs in node by default; pure modules (`config/routes.ts`, `config/nav.ts`,
  `lib/auth/route-access.ts`) are tested without jsdom, a component test opts in with
  `// @vitest-environment jsdom` (stub `window.matchMedia` before rendering `SidebarProvider`).
- `next dev` started by an agent (Claude Code) writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md`
  (Next's agent rules, `node_modules/next/dist/server/lib/generate-agent-files.js`). They are not
  part of the repo: `AGENTS.md` fails `format:check` (`CLAUDE.md` is Prettier-ignored) and both
  leave the tree dirty, so delete them after a smoke run. A human's `yarn dev` does not write them.
- Prettier sorts Tailwind classes; do not fight the order.

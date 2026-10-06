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

```text
apps/web/
  proxy.ts                      cookie-presence redirect for /admin/:path*
  app/layout.tsx                ThemeProvider + TRPCReactProvider + TooltipProvider + <Toaster />
  app/(auth)/layout.tsx         centered card shell; login/, verify-email/, forgot-password/, new-password/
  app/admin/layout.tsx          server-side session check + <AppShell> (sidebar)
  app/admin/**/page.tsx         one page per catalog route, content inside <PageGuard>
  app/admin/{error,not-found}.tsx, app/admin/[...slug]/page.tsx (unknown URLs → 404 in the shell)
  config/routes.ts              THE route catalog: path, title, access; href, findRoute, breadcrumbTrail, safeNextPath
  config/nav.ts                 sidebar groups (NAV_GROUPS) and visibleNavGroups(ability)
  features/auth/                login-form, resend-verification (no sign-up; admin-created users)
  features/users/               users-table, user-editor, profile-form, profile-editor, role-badge
  components/layout/            app-shell, app-sidebar, nav-main, nav-user, app-header
  components/                   page-guard, access-denied, placeholder-page, theme-provider
  lib/auth/{client,server}.ts   authClient (browser) / getServerSession, getCurrentUser (cached), toCurrentUser
  lib/auth/route-access.ts      canAccessRoute, routeDecision — the page and menu access rule
  lib/trpc/{react.tsx,query-client.ts}
  lib/env.ts                    publicEnv.apiUrl (NEXT_PUBLIC_API_URL, zod-validated at load)
```

## Server vs client components

| Need                                                 | Component type                                     |
| ---------------------------------------------------- | -------------------------------------------------- |
| Layout, page shell, static content                   | server (default)                                   |
| Read the session, redirect when signed out           | server (`proxy.ts` + `getCurrentUser` in a layout) |
| Data that can be fetched on the server               | server                                             |
| Forms, buttons with handlers, `useState`, tRPC hooks | client (`"use client"` at the leaf)                |

The app is feature-based: domain components live in `features/<feature>/` and route files under
`app/` import only from `@/features/<feature>/...`, `@/components/...`, `@/config/...`, `@/lib/...`
and `@repo/ui` (never from each other). `components/` keeps the app-wide shell. Keep the
`"use client"` boundary as low as possible: `app/admin/master/user/page.tsx` is a server page
rendering the client `features/users/users-table.tsx`. Only Next.js special files (`page`, `layout`,
`loading`, `error`, `not-found`, `route`, `proxy.ts`, ...) may default-export; everything else is a
named export. A server component may import a value from a client module only to render it — never
call or dot into it (a shared constant lives in a module without `"use client"`).

## Adding a page

1. Add the route to `config/routes.ts`: `{ path, title, access }`; `access` is `"public"`,
   `"signed-in"` or `{ action, subject }` (`read` for list and detail, `create`, `update`).
2. Create `app/admin/<path>/page.tsx` (default export) rendering the feature component (or
   `PlaceholderPage`) inside `<PageGuard route={routes.x.y}>` with that same route.
3. Top-level list pages get a `NavLeaf` (or a `NavBranch` child) in `config/nav.ts`.
4. Link to it with `href(routes.x.y, { id })`, never a string literal.

`test/app/route-tree.test.ts` fails when the catalog and the page tree disagree or a page lacks its
own guard; `test/config/nav.test.ts` holds the per-grant menu cases. The facts behind these steps
(shell, page chrome, Base UI and server/client rules) are in `.claude/rules/ui.md` (Pages, the route
catalog and the sidebar); the access rule in `.claude/rules/permissions.md` (Web).

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
`features/users/users-table.tsx` is the list example (`DataTable`, server-side pagination from
`PageResult`); `features/users/user-editor.tsx` the mutation example (`ConfirmDialog` before
deactivating, never `window.confirm`).

## Forms

`react-hook-form` + `zodResolver(schema)` with the schema from `@repo/validation` — the same schema
the API validates with. Inputs are the bound fields from `@repo/ui/components/form` (`TextField`,
`PasswordField`, `SelectField`, `ComboboxField`, `DateField`, ...; the full table and the zod-shape
mapping are in `.claude/rules/ui.md`, Forms) inside a `FieldGroup`; never hand-write `Field` /
`FieldLabel` / `Input` / `FieldError` for a standard input. Auth forms submit through `authClient`
(`features/auth/login-form.tsx`: `signIn.email` with `callbackURL: next`, a 403 means "unverified"),
everything else through a tRPC mutation (`features/users/profile-form.tsx`, rendered by
`/admin/profile` and `/admin/master/user/[id]`; `emptyAs="null"` on optional nullable fields). Show
server errors in an `Alert`; use `toast` (sonner) for mutation results. Domain pickers live in the
feature that owns the data (a user picker wraps `ComboboxField` with `trpc.user.list` search). There
is no register form: public sign-up is disabled (ADR 0002); `features/auth/resend-verification.tsx`
re-sends the verification mail.

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
  `callbackURL` passed to `sendVerificationEmail` (the resend form passes `/admin`); the login form
  passes `next` as `callbackURL`.
- Tests: `apps/web/test` runs in node by default; pure modules (`config/routes.ts`, `config/nav.ts`,
  `lib/auth/route-access.ts`) are tested without jsdom, a component test opts in with
  `// @vitest-environment jsdom` (stub `window.matchMedia` before rendering `SidebarProvider`).
- `next dev` started by an agent (Claude Code) writes `apps/web/AGENTS.md` and `apps/web/CLAUDE.md`
  (Next's agent rules, `node_modules/next/dist/server/lib/generate-agent-files.js`). They are not
  part of the repo and fail `format:check`: delete them after a smoke run. A human's `yarn dev` does
  not write them.
- Prettier sorts Tailwind classes; do not fight the order.

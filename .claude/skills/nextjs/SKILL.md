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
  proxy.ts                      cookie-presence redirect for /dashboard, /users, /profile
  app/layout.tsx                ThemeProvider + TRPCReactProvider + TooltipProvider + <Toaster />
  app/(auth)/layout.tsx         centered card shell; login/, verify-email/
  app/(app)/layout.tsx          server-side session check + <AppShell>
  app/(app)/dashboard|profile|users|users/[id]
  features/auth/                login-form, resend-verification (no sign-up; admin-created users)
  features/users/               users-table, user-editor, profile-form, profile-editor, role-badge
  components/                   app-wide shell only: app-shell (AppNav, visibleNavItems), theme-provider
  lib/auth/{client,server}.ts   authClient (browser) / getServerSession + toCurrentUser (server)
  lib/trpc/{react.tsx,query-client.ts}
  lib/env.ts                    publicEnv.apiUrl (NEXT_PUBLIC_API_URL, zod-validated at load)
```

## Server vs client components

| Need                                                 | Component type                                       |
| ---------------------------------------------------- | ---------------------------------------------------- |
| Layout, page shell, static content                   | server (default)                                     |
| Read the session, redirect when signed out           | server (`proxy.ts` + `getServerSession` in a layout) |
| Data that can be fetched on the server               | server                                               |
| Forms, buttons with handlers, `useState`, tRPC hooks | client (`"use client"` at the leaf)                  |

The app is feature-based: domain components live in `features/<feature>/` and route files under
`app/` import only from `@/features/<feature>/...` and `@/lib/...` (never from each other).
`components/` keeps the app-wide shell. Keep the `"use client"` boundary as low as possible:
`app/(app)/users/page.tsx` is a server page rendering the client `features/users/users-table.tsx`.
Only Next.js special files (`page`, `layout`, `loading`, `error`, `not-found`, `route`, `proxy.ts`,
...) may default-export; everything else is a named export. A server component may import a value
from a client module only to render it — never call or dot into it (a shared constant lives in a
module without `"use client"`).

## Session and authorization in the web

- `proxy.ts` (replaces `middleware.ts`) checks cookie **presence** only with `getSessionCookie` from
  `better-auth/cookies` and redirects to `/login?next=...`; no network call.
- The real check is `app/(app)/layout.tsx`: `getServerSession()` (`lib/auth/server.ts`, forwards the
  incoming cookie to `/api/auth/get-session`, `cache: "no-store"`, `null` on any failure),
  `redirect("/login")` when null, else `<AppShell user={toCurrentUser(session)}>`.
- `CurrentUser` carries `id`, `role` and the session's `permissions`, so it satisfies `AbilityUser`:
  `AppShell` mounts `AbilityProvider user={user}`, navigation uses `visibleNavItems(ability)` /
  `canUnscoped(ability, "read", "User")`, components use `<Can I="..." a="...">` from
  `@repo/permissions/react`. Never a role literal in the web.
- Sign-out: `authClient.signOut()` then `router.push("/login"); router.refresh()`.

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
everything else through a tRPC mutation (`features/users/profile-form.tsx`, rendered by `/profile`
and `/users/[id]`; `emptyAs="null"` on optional nullable fields). Show server errors in an `Alert`;
use `toast` (sonner) for mutation results. Domain pickers live in the feature that owns the data (a
user picker wraps `ComboboxField` with `trpc.user.list` search). There is no register form: public
sign-up is disabled (ADR 0002); `features/auth/resend-verification.tsx` re-sends the verification
mail.

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
  `callbackURL` passed to `sendVerificationEmail` (the resend form passes `/dashboard`); the login
  form passes `next` as `callbackURL`.
- Tests: `apps/web/test` runs in node by default; a pure module (`visibleNavItems`) is tested
  without jsdom, a component test opts in with `// @vitest-environment jsdom`.
- Prettier sorts Tailwind classes; do not fight the order.

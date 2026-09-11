---
name: nextjs
description: Use when adding a page, layout or route to apps/web, deciding between server and client components, wiring tRPC and React Query, reading the session, or building a form.
---

# Next.js 16 (App Router) in apps/web

## Purpose

`apps/web` is a Next.js 16 App Router app (React 19, Tailwind v4) that talks to `apps/api` over
tRPC and to Better Auth over `/api/auth`. It never touches the database or the queue. Rules:
`.claude/rules/ui.md`, `.claude/rules/layers.md`.

## Layout of the app (no `src/`)

```text
apps/web/
  proxy.ts                      cookie-presence redirect for /dashboard, /users, /profile
  app/layout.tsx                ThemeProvider + TRPCReactProvider + <Toaster />
  app/(auth)/layout.tsx         centered card shell; login/, register/, verify-email/
  app/(app)/layout.tsx          server-side session check + <AppShell>
  app/(app)/dashboard|profile|users|users/[id]
  features/auth/                login-form, register-form, resend-verification
  features/users/               users-table, user-editor, profile-form, profile-editor, role-badge
  components/                   app-wide shell only: app-shell, theme-provider
  lib/auth/{client,server}.ts   authClient (browser) / getServerSession (server)
  lib/trpc/{react.tsx,query-client.ts}
  lib/env.ts                    publicEnv.apiUrl (NEXT_PUBLIC_API_URL)
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
`components/` keeps the app-wide shell. A domain-free component that another app could reuse moves
to `packages/ui/src/components/composed/` (`.claude/rules/ui.md`, promotion rule).

Keep the `"use client"` boundary as low as possible: `app/(app)/users/page.tsx` is a server page
rendering the client `features/users/users-table.tsx`; `app/(auth)/login/page.tsx` renders
`features/auth/login-form.tsx`. Only
Next.js special files (`page`, `layout`, `loading`, `error`, `not-found`, `route`, `proxy.ts`, ...)
may default-export (`packages/eslint-config/next.js`); everything else is a named export.

## `proxy.ts` replaces `middleware.ts`

```ts
// apps/web/proxy.ts
import { getSessionCookie } from "better-auth/cookies";

export const proxy = (request: NextRequest) => {
  if (!getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
};

export const config = { matcher: ["/dashboard/:path*", "/users/:path*", "/profile/:path*"] };
```

It checks cookie **presence** only (no network call, as Better Auth recommends). The real check is
the `(app)` layout:

```tsx
// apps/web/app/(app)/layout.tsx
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return <AppShell user={toCurrentUser(session)}>{children}</AppShell>;
};
```

`getServerSession` (`lib/auth/server.ts`) forwards the incoming `cookie` header to
`${publicEnv.apiUrl}/api/auth/get-session` with `cache: "no-store"` and returns `null` on any
failure; `toCurrentUser` narrows `role` with `roleSchema`. `AppShell` mounts `AbilityProvider` and
the nav (`Users` hidden for `member`), and signs out with `authClient.signOut()` followed by
`router.push("/login"); router.refresh()`.

## tRPC + React Query (`@trpc/tanstack-react-query`)

1. `lib/trpc/react.tsx`: `export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()`
   (`import type { AppRouter } from "@repo/api/router"`).
2. `TRPCReactProvider` (`"use client"`) creates one `QueryClient` (`getQueryClient`) and one tRPC
   client (`httpBatchLink` to `${publicEnv.apiUrl}/trpc`, `transformer: superjson`, a `fetch`
   override with `credentials: "include"`) and wraps the app from `app/layout.tsx`.
3. In components: `const trpc = useTRPC();` then
   `useQuery(trpc.user.list.queryOptions({ page, perPage, search, role }))`,
   `useMutation(trpc.user.updateProfile.mutationOptions({ onSuccess, onError }))`, and invalidate
   with `queryClient.invalidateQueries(trpc.user.pathFilter())`.

`features/users/users-table.tsx` is the list example: `useState` for `page`, `search`, `role`; the
standalone `Select` (Base UI: `items`, `onValueChange`) for the role filter; columns from
`createDataTableColumns<UserRow>()`; `DataTable` from `@repo/ui/components/composed/data-table`
with `isLoading` and a server-side `pagination` object built from the `PageResult`.
`features/users/user-editor.tsx` is the mutation example, including `ConfirmDialog` (never
`window.confirm`) before deactivating a user.

## Forms

`react-hook-form` + `zodResolver(schema)` with the schema from `@repo/validation` — the same schema
the API validates with. Inputs are the bound fields from `@repo/ui/components/form` (`TextField`,
`NumberField`, `SelectField`, `ComboboxField`, `DateField`, `FileField`, `ArrayField`, ... — the
full table and the zod-shape mapping are in `.claude/rules/ui.md`, Forms) inside a `FieldGroup`;
never hand-write `Field` / `FieldLabel` / `Input` / `FieldError` for a standard input. Domain
pickers live in the feature that owns the data: `UserPickerField`
(`features/users/user-picker-field.tsx`) wraps `ComboboxField` with `trpc.user.list` search
(debounced 250 ms, 20 results) and `user.byId` for the current value's label, and stores the user
id. Field `hint` tooltips rely on the `TooltipProvider` that `app/layout.tsx` wraps the app in
(next to `ThemeProvider` and `TRPCReactProvider`); do not add a second one per form. Auth forms
submit through `authClient`, everything else through a tRPC mutation.

```tsx
// apps/web/features/auth/login-form.tsx
const form = useForm<SignInInput>({
  resolver: zodResolver(signInSchema),
  defaultValues: { email: "", password: "" },
});

const onSubmit = form.handleSubmit(async (values) => {
  const { error } = await authClient.signIn.email({ ...values, callbackURL: next });
  if (error) {
    setServerError({
      message: error.message ?? "Sign in failed",
      unverified: error.status === 403,
    });
    return;
  }
  router.push(next);
  router.refresh();
});

<FieldGroup>
  <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
  <PasswordField control={form.control} name="password" label="Password" />
</FieldGroup>;
```

`register-form.tsx` does the same with `signUpSchema` and `authClient.signUp.email(...)`, passing
`callbackURL` = `<window.location.origin>/dashboard` (where Better Auth lands the user after the
verification link) and then routing to `/verify-email?email=...`. `features/users/profile-form.tsx`
(rendered by `/profile` via `profile-editor.tsx` and by `/users/[id]` via `user-editor.tsx`) uses
`updateProfileSchema`, `trpc.user.updateProfile` and `emptyAs="null"` on the optional
`employeeCode` / `department` fields so a cleared input stores `null`. Show server errors in an
`Alert`; use `toast` (sonner) for mutation results.

## Env

Only `NEXT_PUBLIC_*` variables reach the browser (`NEXT_PUBLIC_API_URL=http://localhost:4000`,
read through `lib/env.ts`); they are inlined at build time. Everything else stays on the server.

## Gotchas

- Yarn 4 with `nodeLinker: node-modules` is required (`.yarnrc.yml`); PnP breaks Next.js.
- `apps/web` may import `@repo/api` types only; `@repo/database`, `@repo/queue`, `@repo/logger`,
  `@repo/permissions/server` and the `@repo/auth` server entry are lint-forbidden in the web
  element (use `@repo/permissions`, `@repo/permissions/react`, `@repo/auth/client`).
- `superjson` must be configured on both the server (`init.ts`) and the client link, or dates
  break.
- Server-side data pattern: server components read the session with `getServerSession` (plain
  `fetch` with the forwarded cookie) and leave tRPC data fetching to client components. Do not call
  the browser tRPC client from a server component.
- After a verification link is clicked, Better Auth signs the user in and redirects to the
  `callbackURL` given at sign-up (`/dashboard`); the login form passes `next` as `callbackURL`.
- Prettier sorts Tailwind classes; do not fight the order.

---
name: nextjs
description: Use when adding a page, layout or route to apps/web, deciding between server and client components, wiring tRPC and React Query, reading the session, or building a form.
---

# Next.js 16 (App Router) in apps/web

## Purpose

`apps/web` is a Next.js 16 App Router app (React 19, Tailwind v4) that talks to `apps/api` over
tRPC. It never touches the database or the queue. Rules: `.claude/rules/ui.md`,
`.claude/rules/layers.md`.

## Server vs client components

| Need                                                 | Component type                      |
| ---------------------------------------------------- | ----------------------------------- |
| Layout, page shell, static content                   | server (default)                    |
| Read the session, redirect when signed out           | server (`proxy.ts` + server lookup) |
| Data that can be fetched on the server               | server                              |
| Forms, buttons with handlers, `useState`, tRPC hooks | client (`"use client"` at the leaf) |

Keep the `"use client"` boundary as low as possible. Only Next.js special files (`page`, `layout`,
`loading`, `error`, `not-found`, `route`, `proxy.ts`, ...) may default-export
(`packages/eslint-config/next.js`); everything else is a named export.

## `proxy.ts` replaces `middleware.ts`

Next 16 runs request interception from `apps/web/src/proxy.ts` (default export). Use it for
redirects on a missing session cookie and header handling; keep it thin — the API re-checks
everything.

<!-- Phase 1: add real example (proxy.ts protecting /dashboard, server-side session in a layout) -->

## tRPC + React Query (`@trpc/tanstack-react-query`)

1. `createTRPCContext<AppRouter>()` → export `TRPCProvider` and `useTRPC`
   (`import type { AppRouter } from "@repo/api/router"`).
2. A client provider component (`"use client"`) creates one `QueryClient` and one tRPC client
   (`httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc`, `transformer: superjson`, a `fetch`
   override with `credentials: "include"`) and wraps the app in `QueryClientProvider` +
   `TRPCProvider` from the root layout.
3. In components: `const trpc = useTRPC();` then `useQuery(trpc.health.ping.queryOptions())`,
   `useMutation(trpc.user.updateProfile.mutationOptions())`, and invalidate with
   `queryClient.invalidateQueries({ queryKey: trpc.user.list.queryKey() })`.

<!-- Phase 1: add real example (provider file, users list with pagination and search) -->

## Forms

`react-hook-form` + `zodResolver(schema)` with the schema from `@repo/validation` — the same
schema the API validates with. Submit through a tRPC mutation; show `error.data.requestId` in the
error message so users can quote it.

<!-- Phase 1: add real example (login form with updateProfileSchema-style validation) -->

## Env

Only `NEXT_PUBLIC_*` variables reach the browser (`NEXT_PUBLIC_API_URL=http://localhost:4000`);
they are inlined at build time. Everything else stays on the server.

## Gotchas

- Yarn 4 with `nodeLinker: node-modules` is required (`.yarnrc.yml`); PnP breaks Next.js.
- `apps/web` may import `@repo/api` types only; `@repo/database`, `@repo/queue` and
  `@repo/logger` are lint-forbidden in the web element.
- `superjson` must be configured on both the server (`init.ts`) and the client link, or dates
  break.
- Do not call the browser tRPC client from server components; Phase 1 decides the server-side
  data pattern once (server caller or fetch) and every page follows it.
- Prettier sorts Tailwind classes; do not fight the order.

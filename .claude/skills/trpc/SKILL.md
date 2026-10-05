---
name: trpc
description:
  Use when adding or changing a tRPC router or procedure, wiring error mapping, or calling a
  procedure from the Next.js app.
---

# tRPC 11 in this repo

tRPC is the only transport today (`apps/api/src/trpc`), mounted by Hono at `/trpc/*`
(`apps/api/src/app.ts`, `@hono/trpc-server`). Routers are thin: **zod input → ability check →
service call**. Rules: `.claude/rules/module-template.md`, `.claude/rules/layers.md`,
`.claude/rules/permissions.md`.

## Building blocks (`apps/api/src/trpc/init.ts`)

- `initTRPC.context<RequestContext>()` with the `superjson` transformer; the `errorFormatter` adds
  `requestId` to `error.data`.
- `publicProcedure` = `t.procedure.use(domainErrorMapping)`: turns domain errors thrown by services
  into `TRPCError` via `toTRPCError` (`core/error-mapping.ts`) and logs the failure once.
- `protectedProcedure` = `publicProcedure` + `UNAUTHORIZED` when `ctx.user` is null; narrows
  `ctx.user` to non-null for the procedure.
- `requireAbility(action, subjectName)` = a middleware that throws
  `ForbiddenError("Not allowed to <action> <subject>")` when `ctx.ability.can(...)` is false
  (layer-1 authorization; the service checks the row and re-checks the type-level ability).
- `router`, `mergeRouters`, `createCallerFactory` are re-exported for routers and tests.
- Context: `buildRequestContext({ headers, requestId }, deps)` in `core/context.ts` resolves the
  Better Auth session into `ctx.user` (with `permissions`) and builds `ctx.ability`. Every transport
  wraps it; nothing else builds a context.

## How-to: add a procedure

1. Input schema in `packages/validation/src/<name>.schema.ts` (shared with web forms).
2. Service function in `apps/api/src/modules/<name>/<name>.service.ts` taking `ctx` first and
   throwing `NotFoundError` / `ForbiddenError` / `ConflictError` / `ValidationError`.
3. Procedure in `apps/api/src/trpc/routers/<name>.router.ts` as
   `protectedProcedure.use(requireAbility(action, subject)).input(schema).query|mutation(({ ctx, input }) => service(ctx, input))`
   — `apps/api/src/trpc/routers/user.router.ts` is the reference (`me`, `byId`, `list`,
   `updateProfile`, `changeRole`, `deactivate` with the `status` action). The action is a catalog
   action (`.claude/rules/permissions.md`).
4. Register in `apps/api/src/trpc/router.ts`: `router({ health: healthRouter, user: userRouter })`.
5. Test through `createCallerFactory(appRouter)` with a context from `contextFor`
   (`apps/api/test/trpc/routers/user.router.test.ts`): `UNAUTHORIZED` without a session, `FORBIDDEN`
   from `requireAbility` (its message differs from the service's, which proves the layer),
   `BAD_REQUEST` from the zod schema, `CONFLICT` mapped from a service `ConflictError`.

## Error mapping (`core/error-mapping.ts`)

| Domain error      | tRPC code               | HTTP |
| ----------------- | ----------------------- | ---- |
| `NotFoundError`   | `NOT_FOUND`             | 404  |
| `ForbiddenError`  | `FORBIDDEN`             | 403  |
| `ConflictError`   | `CONFLICT`              | 409  |
| `ValidationError` | `BAD_REQUEST`           | 400  |
| anything else     | `INTERNAL_SERVER_ERROR` | 500  |

Unknown errors never leak their message ("Internal server error"); the cause is logged with the
`requestId`. Domain error messages are client-visible: write them for a person.

## Client side (`apps/web`, `@trpc/tanstack-react-query`)

- `apps/web/lib/trpc/react.tsx`: `createTRPCContext<AppRouter>()` gives `TRPCProvider`, `useTRPC`
  and `useTRPCClient`; `AppRouter` is imported type-only from `@repo/api/router`.
  `TRPCReactProvider` (mounted in `apps/web/app/layout.tsx`) creates the `QueryClient` and one
  `createTRPCClient` with `httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc`, the `superjson`
  transformer and a `fetch` override that sets `credentials: "include"` (session cookie).
- In components: `const trpc = useTRPC();` then
  `useQuery(trpc.user.list.queryOptions({ page, perPage, search, role }))` (`users-table.tsx`),
  `useMutation(trpc.user.changeRole.mutationOptions({ onSuccess, onError }))` (`user-editor.tsx`).
  Naming mirrors the server (`trpc.<router>.<procedure>`); do not wrap calls in custom hooks unless
  two components share the exact same call.
- Query keys come from `queryOptions` / `queryKey()` / `pathFilter()` — never hand-written.
  Invalidate a whole router with `queryClient.invalidateQueries(trpc.user.pathFilter())`.

## Gotchas

- Never throw `TRPCError` in a service; the middleware maps domain errors only.
- Never put `if` / business logic in a router — a reviewer BLOCKER.
- `protectedProcedure` proves authentication, not authorization: add `requireAbility(...)`.
- Over HTTP a protected procedure without a session answers 401 (`apps/api/test/app.test.ts`);
  `/trpc/user.me` with the Better Auth cookie is the smoke test for session resolution.
- Routers import `@repo/database` **types** only (value imports are lint-forbidden there).
- The `errorFormatter` exposes `requestId`; surface it in the web error UI so users can quote it.
- CORS on `/trpc/*` allows only `WEB_ORIGIN` with credentials; a new request header must be added to
  `allowHeaders` in `apps/api/src/app.ts`.

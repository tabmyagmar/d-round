---
name: trpc
description: Use when adding or changing a tRPC router or procedure, wiring error mapping, or calling a procedure from the Next.js app.
---

# tRPC 11 in this repo

## Purpose

tRPC is the only transport today (`apps/api/src/trpc`), mounted by Hono at `/trpc/*`
(`apps/api/src/app.ts`, `@hono/trpc-server`). Routers are thin: **zod input → ability check →
service call**. Rules: `.claude/rules/module-template.md`, `.claude/rules/layers.md`,
`.claude/rules/permissions.md`.

## Building blocks (`apps/api/src/trpc/init.ts`)

- `initTRPC.context<RequestContext>()` with the `superjson` transformer; the `errorFormatter`
  adds `requestId` to `error.data`.
- `publicProcedure` = `t.procedure.use(domainErrorMapping)`: a middleware that turns domain
  errors thrown by services into `TRPCError` via `toTRPCError` (`core/error-mapping.ts`) and logs
  the failure once (`warn` for rejected requests, `error` for internal failures).
- `protectedProcedure` = `publicProcedure` + `UNAUTHORIZED` when `ctx.user` is null; narrows
  `ctx.user` to non-null for the procedure.
- `router`, `mergeRouters`, `createCallerFactory` are re-exported for routers and tests.
- Context: `buildRequestContext({ headers, requestId }, deps)` in `core/context.ts` — every
  transport wraps it; nothing else builds a context.

## How-to: add a procedure

1. Input schema in `packages/validation/src/<name>.schema.ts` (shared with web forms).
2. Service function in `apps/api/src/modules/<name>/<name>.service.ts` taking `ctx` first and
   throwing `NotFoundError` / `ForbiddenError` / `ConflictError` / `ValidationError`.
3. Procedure in `apps/api/src/trpc/routers/<name>.router.ts`:

   ```ts
   export const userRouter = router({
     byId: protectedProcedure
       .input(idSchema)
       // ability check — Phase 1: requireAbility("read", "User")
       .query(({ ctx, input }) => userService.getById(ctx, input)),
   });
   ```

4. Register in `apps/api/src/trpc/router.ts`: `router({ health: healthRouter, user: userRouter })`.
5. Test with the caller: `const caller = createCallerFactory(appRouter)(ctx);` then
   `await expect(caller.user.byId(id)).rejects.toMatchObject({ code: "NOT_FOUND" });`.

<!-- Phase 1: add real example (user.router.ts: me, byId, list, updateProfile, changeRole, deactivate) -->

## Error mapping (`core/error-mapping.ts`)

| Domain error      | tRPC code               | HTTP |
| ----------------- | ----------------------- | ---- |
| `NotFoundError`   | `NOT_FOUND`             | 404  |
| `ForbiddenError`  | `FORBIDDEN`             | 403  |
| `ConflictError`   | `CONFLICT`              | 409  |
| `ValidationError` | `BAD_REQUEST`           | 400  |
| anything else     | `INTERNAL_SERVER_ERROR` | 500  |

Unknown errors never leak their message ("Internal server error"); the cause is logged with the
`requestId`.

## Client side (`apps/web`, `@trpc/tanstack-react-query`)

- `createTRPCContext<AppRouter>()` gives `TRPCProvider` and `useTRPC`; `AppRouter` is imported
  type-only from `@repo/api/router`.
- The client uses `httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc` with the `superjson`
  transformer and a `fetch` override that sets `credentials: "include"` (cookies, Phase 1).
- In components: `const trpc = useTRPC();` then `useQuery(trpc.health.ping.queryOptions())`,
  `useMutation(trpc.user.updateProfile.mutationOptions())`. Naming mirrors the server
  (`trpc.<router>.<procedure>`); do not wrap calls in custom hooks unless two components share
  the exact same call.
- Query keys come from `queryOptions` / `queryKey()` — never hand-written.

<!-- Phase 1: add real example (provider file, a list page with pagination) -->

## Gotchas

- Never throw `TRPCError` in a service; the middleware maps domain errors only.
- Never put `if` / business logic in a router — a reviewer BLOCKER.
- `protectedProcedure` proves authentication, not authorization: add the ability check.
- Routers import `@repo/database` **types** only (value imports are lint-forbidden there).
- The `errorFormatter` exposes `requestId`; surface it in the web error UI so users can quote it.
- CORS on `/trpc/*` allows only `WEB_ORIGIN` with credentials; a new request header must be added
  to `allowHeaders` in `apps/api/src/app.ts`.

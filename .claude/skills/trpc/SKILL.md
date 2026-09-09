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
- `requireAbility(action, subjectName)` = a middleware that throws `ForbiddenError` when
  `ctx.ability.can(action, subjectName)` is false (layer-1 authorization; the service checks the
  row):

  ```ts
  export const requireAbility = (action: Action, subjectName: SubjectName) =>
    t.middleware(({ ctx, next }) => {
      if (!ctx.ability.can(action, subjectName)) {
        throw new ForbiddenError(`Not allowed to ${action} ${subjectName}`);
      }
      return next();
    });
  ```

- `router`, `mergeRouters`, `createCallerFactory` are re-exported for routers and tests.
- Context: `buildRequestContext({ headers, requestId }, deps)` in `core/context.ts` — resolves
  the Better Auth session (`auth.api.getSession({ headers })`) into `ctx.user` and builds
  `ctx.ability` (`definePrismaAbilityFor`). Every transport wraps it; nothing else builds a
  context.

## How-to: add a procedure

1. Input schema in `packages/validation/src/<name>.schema.ts` (shared with web forms).
2. Service function in `apps/api/src/modules/<name>/<name>.service.ts` taking `ctx` first and
   throwing `NotFoundError` / `ForbiddenError` / `ConflictError` / `ValidationError`.
3. Procedure in `apps/api/src/trpc/routers/<name>.router.ts` — the user router is the reference:

   ```ts
   // apps/api/src/trpc/routers/user.router.ts
   export const userRouter = router({
     me: protectedProcedure
       .use(requireAbility("read", "User"))
       .query(({ ctx }) => userService.getById(ctx, ctx.user.id)),

     byId: protectedProcedure
       .use(requireAbility("read", "User"))
       .input(userIdSchema)
       .query(({ ctx, input }) => userService.getById(ctx, input.userId)),

     list: protectedProcedure
       .use(requireAbility("read", "User"))
       .input(listUsersSchema)
       .query(({ ctx, input }) => userService.list(ctx, input)),

     updateProfile: protectedProcedure
       .use(requireAbility("update", "User"))
       .input(updateProfileSchema)
       .mutation(({ ctx, input }) => userService.updateProfile(ctx, input)),

     changeRole: protectedProcedure
       .use(requireAbility("changeRole", "User"))
       .input(changeRoleSchema)
       .mutation(({ ctx, input }) => userService.changeRole(ctx, input)),

     deactivate: protectedProcedure
       .use(requireAbility("delete", "User"))
       .input(userIdSchema)
       .mutation(({ ctx, input }) => userService.deactivate(ctx, input.userId)),
   });
   ```

4. Register in `apps/api/src/trpc/router.ts`: `router({ health: healthRouter, user: userRouter })`.
5. Test with the caller and the harness (`apps/api/test/support.ts`):

   ```ts
   const createCaller = createCallerFactory(appRouter);
   const member = await signedInUser(h);
   const caller = createCaller(await contextFor(h, member.headers));
   await expect(
     caller.user.changeRole({ userId: member.user.id, role: "admin" }),
   ).rejects.toMatchObject({ code: "FORBIDDEN" });
   ```

   `apps/api/src/trpc/routers/user.router.test.ts` covers `UNAUTHORIZED` without a session,
   `FORBIDDEN` from `requireAbility`, `BAD_REQUEST` from the zod schemas and `CONFLICT` mapped from
   a service `ConflictError`.

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

- `apps/web/lib/trpc/react.tsx`: `createTRPCContext<AppRouter>()` gives `TRPCProvider`, `useTRPC`
  and `useTRPCClient`; `AppRouter` is imported type-only from `@repo/api/router`.
  `TRPCReactProvider` (mounted in `apps/web/app/layout.tsx`) creates the `QueryClient` and one
  `createTRPCClient` with `httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc`, the `superjson`
  transformer and a `fetch` override that sets `credentials: "include"` (session cookie).
- In components: `const trpc = useTRPC();` then
  `useQuery(trpc.user.list.queryOptions({ page, perPage, search, role }))` (`users-table.tsx`),
  `useMutation(trpc.user.changeRole.mutationOptions({ onSuccess, onError }))` (`user-editor.tsx`).
  Naming mirrors the server (`trpc.<router>.<procedure>`); do not wrap calls in custom hooks
  unless two components share the exact same call.
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
- CORS on `/trpc/*` allows only `WEB_ORIGIN` with credentials; a new request header must be added
  to `allowHeaders` in `apps/api/src/app.ts`.

---
paths:
  - "apps/api/src/modules/**"
---

# Module template (mandatory)

A module is one domain aggregate (user, template, submission, ...). Every module consists of the
same four files plus their tests, and is wired into the router the same way. Do not invent a
different shape and do not merge files "because the module is small". The `user` module is the
reference implementation — copy its structure for every later module:

| #   | File                                                    | Layer      | Contains                                                                     |
| --- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| 1   | `packages/validation/src/user.schema.ts`                | validation | zod input schemas, shared with `apps/web` forms via `@repo/validation`       |
| 2   | `packages/database/src/repositories/user.repository.ts` | repository | `createUserRepository(db: DbClient)`: pure data access, Prisma types         |
| 3   | `apps/api/src/modules/user/user.service.ts`             | service    | business rules; every function takes `ctx: RequestContext` as FIRST argument |
| 4   | `apps/api/src/trpc/routers/user.router.ts`              | transport  | procedures: zod input → ability check → service call, nothing else           |

For a new module `<name>` the files are `packages/validation/src/<name>.schema.ts`,
`packages/database/src/repositories/<name>.repository.ts`,
`apps/api/src/modules/<name>/<name>.service.ts` and `apps/api/src/trpc/routers/<name>.router.ts`.

Plus:

- Tests in the workspace's `test/` folder, mirroring `src/`:
  `packages/database/test/repositories/user.repository.test.ts`,
  `apps/api/test/modules/user/user.service.test.ts`,
  `apps/api/test/trpc/routers/user.router.test.ts` (see `.claude/rules/testing.md`). Schema tests
  (`packages/validation/test/<name>.schema.test.ts`) only when a schema carries non-trivial
  transforms.
- Registration: add the router to `apps/api/src/trpc/router.ts`
  (`router({ health: healthRouter, user: userRouter })`) and the repository to the barrel
  `packages/database/src/repositories/index.ts`.
- Export the module's Prisma model types from `packages/database/src/index.ts` — consumers never
  import from `src/generated`.
- Screens: the module's pages already exist as guarded placeholders in `apps/web/app/admin/` (routes
  in `apps/web/config/routes.ts`); replace each `PlaceholderPage` with a component from
  `apps/web/features/<name>/` and keep the `PageGuard` (skill `nextjs`, "Adding a page").

## 1. Schema — `packages/validation/src/user.schema.ts`

```ts
import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";

export const ROLES = ["super_admin", "admin", "manager", "staff"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const userIdSchema = z.object({ userId: idSchema });

/** Self edit when `userId` is omitted; admins may pass another user's id. */
export const updateProfileSchema = z.object({
  userId: idSchema.optional(),
  name: nameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** 担当者情報編集: any subset, saved together; role and permission changes need `changeRole`. */
export const updateUserSchema = z.object({
  userId: idSchema,
  name: nameSchema.optional(),
  role: roleSchema.optional(),
  permissionKeys: permissionKeysSchema.optional(),
});

export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
});
export type ListUsersQuery = z.output<typeof listUsersSchema>;
```

Schemas describe **input shape** only. Rules that need data (uniqueness, state transitions, "last
admin") belong in the service. Re-export from `packages/validation/src/index.ts`. The same file also
holds `signInSchema`, which the login form shares with Better Auth (public sign-up is disabled;
users are created through `auth.api.createUser`).

## 2. Repository — `packages/database/src/repositories/user.repository.ts`

```ts
import type { Prisma, User } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

export const createUserRepository = (db: DbClient) => ({
  findById: (id: string): Promise<User | null> =>
    db.user.findFirst({ where: { id, deletedAt: null } }),

  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.UserWhereInput = {},
  ): Promise<PageResult<User>> => {
    const page = normalizePage(params);
    const scoped: Prisma.UserWhereInput = { AND: [where, { deletedAt: null }] };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where: scoped,
        ...toSkipTake(page),
        orderBy: { createdAt: "desc" },
      }),
      db.user.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  // The role list is a parameter: the database element may not import @repo/validation.
  countActiveAdmins: (roles: readonly string[]): Promise<number> =>
    db.user.count({ where: { role: { in: [...roles] }, deletedAt: null } }),

  updateProfile: (id: string, data: UserProfileUpdate): Promise<User> =>
    db.user.update({ where: { id }, data }),

  updateRole: (id: string, role: string): Promise<User> =>
    db.user.update({ where: { id }, data: { role } }),

  /** Deactivation: soft delete + Better Auth ban so the user can no longer sign in. */
  softDelete: (id: string): Promise<User> =>
    db.user.update({
      where: { id },
      data: { deletedAt: new Date(), banned: true, banReason: "deactivated" },
    }),
});

export type UserRepository = ReturnType<typeof createUserRepository>;
```

`DbClient = PrismaClient | Prisma.TransactionClient`, so the same factory works inside
`withTransaction` (`createUserRepository(tx)`). Read methods exclude soft-deleted rows unless the
name says otherwise (`findByIdIncludingDeleted`). The `where` a list method receives is composed by
the service (ability filter + search) and passed through as a Prisma type. No zod, no
`@repo/validation`, no `@repo/queue`, no business decisions — the linter rejects the imports and the
reviewer rejects the rest (`.claude/rules/repositories.md`).

## 3. Service — `apps/api/src/modules/user/user.service.ts`

```ts
import { createUserRepository, translateDatabaseError, withTransaction } from "@repo/database";
import type { PageResult, Prisma, UniqueViolationError, User } from "@repo/database";
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";
import { ADMIN_ROLES } from "@repo/validation";
import type { ListUsersQuery, UpdateProfileInput, UpdateUserInput } from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";

const loadUser = async (ctx: RequestContext, userId: string): Promise<User> => {
  const user = await createUserRepository(ctx.db).findById(userId);
  if (!user) {
    throw new NotFoundError("User", userId);
  }
  return user;
};

/** Row-level check: the router only proved the role may attempt the action at all. */
const assertCan = (ctx: RequestContext, action: "read" | "update", user: User): void => {
  if (!ctx.ability.can(action, prismaUserSubject(user))) {
    throw new ForbiddenError(`Not allowed to ${action} this user`);
  }
};

export const getById = async (ctx: RequestContext, userId: string): Promise<User> => {
  const user = await loadUser(ctx, userId);
  assertCan(ctx, "read", user);
  return user;
};

export const list = async (
  ctx: RequestContext,
  query: ListUsersQuery,
): Promise<PageResult<User>> => {
  if (!ctx.ability.can("read", "User")) {
    throw new ForbiddenError("Not allowed to list users");
  }
  const filters: Prisma.UserWhereInput[] = [accessibleUsersWhere(ctx.ability, "read")];
  if (query.role) {
    filters.push({ role: query.role });
  }
  return createUserRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
  );
};

export const updateProfile = async (ctx: RequestContext, input: UpdateProfileInput) => {
  const target = await loadUser(ctx, input.userId ?? ctx.user.id);
  assertCan(ctx, "update", target);
  try {
    return await createUserRepository(ctx.db).updateProfile(target.id, data);
  } catch (error) {
    const translated = translateDatabaseError(error);
    if (translated?.name === "UniqueViolationError") {
      const fields = (translated as UniqueViolationError).fields.join(", ");
      throw new ConflictError(`Value already in use: ${fields || "unique field"}`, {
        cause: error,
      });
    }
    throw error;
  }
};

const isAdminRole = (role: string | null): boolean =>
  role !== null && (ADMIN_ROLES as readonly string[]).includes(role);

export const update = async (ctx: RequestContext, input: UpdateUserInput): Promise<UserDetail> => {
  const { user: actor } = requireUser(ctx);
  return withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const target = await users.findById(input.userId);
    if (!target) {
      throw new NotFoundError("User", input.userId);
    }
    assertCan(ctx, "update", target); // the router checked `update User` at type level only
    const role = input.role ?? target.role;
    if (role !== target.role) {
      // Catalog row 1106 plus the role picker rule (assignableRoles), then the stateful rule:
      // the organisation must always keep one active admin-role user (ADMIN_ROLES).
      assertMayChangeRoles(ctx, "Not allowed to change roles");
      assertAssignable(actor, role, target.role);
      if (
        isAdminRole(target.role) &&
        !isAdminRole(role) &&
        (await users.countActiveAdmins(ADMIN_ROLES)) <= 1
      ) {
        throw new ConflictError("Cannot demote the last admin");
      }
      await users.updateRole(target.id, role);
    }
    // … name, permission overrides (ALLOW / DENY rows), then the user with permissionKeys.
  });
};
```

(Abridged: the real file also has `requireUser`, `assertMayChangeRoles`, `assertAssignable`
(`assignableRoles` from `@repo/validation`), `overridesFor`, `UserDetail` (the row plus its
effective `permissionKeys`), the `search` / `status` / sort handling of `list`, and `deactivate`,
which checks `status User` at type level and `assertCan(ctx, "status", target)` on the row, then
soft-deletes the user and deletes its sessions inside one `withTransaction`.)

Rules:

- `ctx: RequestContext` (`apps/api/src/core/context.ts`) is always the first parameter. It carries
  `requestId`, `logger`, `headers`, `user`, `ability`, `db`, `redis`, `auth`. Log through
  `ctx.logger`, never `console`.
- Two authorization layers (`.claude/rules/permissions.md`): the router ran
  `requireAbility(action, "User")` (coarse); the service checks the concrete row with
  `ctx.ability.can(action, prismaUserSubject(row))` and applies stateful rules (last admin,
  self-deactivation). A service never assumes the router already checked something that matters for
  its own invariants.
- Throw only `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError` from
  `apps/api/src/core/errors.ts`. Never `TRPCError`, never a bare `Error` for an expected failure.
- Translate database constraint failures here with `translateDatabaseError` / `isUniqueViolation`
  from `@repo/database` into `ConflictError`; nothing else compares Prisma or Postgres error codes.
- Multi-statement writes and read-then-write invariants use
  `withTransaction(ctx.db, async ({ tx, afterCommit }) => ...)` (`@repo/database`); queue producers
  and other side effects are registered with `afterCommit` and never run inside the transaction
  (`.claude/rules/queue.md`, `apps/api/src/modules/email/email.service.ts`).
- Named exports, one function per concern, no default export, no transport imports.
- The `health` service is the single exception to "ctx first": it is infrastructure-level and runs
  before any request context exists.

## 4. Router — `apps/api/src/trpc/routers/user.router.ts`

```ts
import {
  listUsersSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdSchema,
} from "@repo/validation";

import * as userService from "../../modules/user/user.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Nothing else. */
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

  // Role and permission changes additionally need `changeRole`; the service checks them.
  update: protectedProcedure
    .use(requireAbility("update", "User"))
    .input(updateUserSchema)
    .mutation(({ ctx, input }) => userService.update(ctx, input)),

  deactivate: protectedProcedure
    .use(requireAbility("status", "User"))
    .input(userIdSchema)
    .mutation(({ ctx, input }) => userService.deactivate(ctx, input.userId)),
});
```

Rules:

- Every procedure is exactly `protectedProcedure.use(requireAbility(action, subject))` →
  `input(zodSchema)` → one service call. No `if`, no Prisma, no result shaping, no try/catch —
  `apps/api/src/trpc/init.ts` already maps domain errors to `TRPCError` and adds `requestId` to the
  error payload.
- `requireAbility` (`apps/api/src/trpc/init.ts`) throws `ForbiddenError` when
  `ctx.ability.can(action, subjectName)` is false, before the service runs. `publicProcedure` is for
  health and auth-less endpoints only.
- Register in `apps/api/src/trpc/router.ts`; `AppRouter` is the type `apps/web` consumes.

## 5. Tests — `apps/api/test/support.ts`

Every API test uses the shared harness (real Postgres + Redis via testcontainers, real Better Auth):

```ts
import { contextFor, createHarness, signedInUser } from "../../../test/support";
import type { TestHarness } from "../../../test/support";
import { createCallerFactory } from "../init";
import { appRouter } from "../router";

let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.stop();
});

it("maps layer-1 denials to FORBIDDEN before touching the service", async () => {
  const staff = await signedInUser(h);
  const caller = createCaller(await contextFor(h, staff.headers));
  await expect(caller.user.update({ userId: staff.user.id, role: "admin" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
```

- `createHarness()` builds `db`, `redis`, `auth`, `emailQueue`, a silent logger and collects the
  verification mails Better Auth asked for (`sentMails`).
- `signedInUser(h, { role, name })` creates a verified user with the requested role through
  `auth.api.createUser` (server-side, so no session is needed), signs in for real and returns
  `{ user, email, headers }` — `headers` carries the session cookie.
- `contextFor(h, headers)` builds a `RequestContext` exactly as the transport would
  (`buildRequestContext`), so service tests call the service directly with that context
  (`userService.getById(ctx, id)`) and router tests go through `createCallerFactory(appRouter)`.
- Assert on domain errors in service tests (`rejects.toBeInstanceOf(ConflictError)`) and on tRPC
  codes in router tests (`rejects.toMatchObject({ code: "CONFLICT" })`).

## Checklist before you call a module done

- [ ] Four files exist with the exact names and suffixes above; kebab-case; named exports.
- [ ] Service functions take `ctx: RequestContext` first and throw only domain errors.
- [ ] Repository contains no validation, business rules or queue code.
- [ ] Every non-public procedure has `requireAbility(...)`; the service re-checks the row with
      `prismaUserSubject` (or the module's subject helper) and its stateful invariants.
- [ ] Tests under `test/` mirroring `src/` (`apps/api/test/modules/<name>/`,
      `apps/api/test/trpc/routers/`, `packages/database/test/repositories/`) using
      `apps/api/test/support.ts`; anything touching Postgres or Redis uses testcontainers.
- [ ] Router registered in `router.ts`; repository exported from the barrel; model types exported
      from `packages/database/src/index.ts`.
- [ ] Schema change (if any) has a migration and an ADR line (`.claude/rules/migrations.md`).
- [ ] `yarn verify` is green.

import { createUserRepository, translateDatabaseError, withTransaction } from "@repo/database";
import type { PageResult, Prisma, UniqueViolationError, User } from "@repo/database";
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";
import type { ChangeRoleInput, ListUsersQuery, UpdateProfileInput } from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";

/**
 * User module — the reference implementation of .claude/rules/module-template.md.
 * Layer 1 (CASL, coarse) ran in the router; this service applies row-level and stateful rules.
 */

type AuthenticatedContext = RequestContext & { user: NonNullable<RequestContext["user"]> };

const requireUser = (ctx: RequestContext): AuthenticatedContext => {
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  return ctx as AuthenticatedContext;
};

const loadUser = async (ctx: RequestContext, userId: string): Promise<User> => {
  const user = await createUserRepository(ctx.db).findById(userId);
  if (!user) {
    throw new NotFoundError("User", userId);
  }
  return user;
};

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
  if (query.search) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  return createUserRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
  );
};

export const updateProfile = async (
  ctx: RequestContext,
  input: UpdateProfileInput,
): Promise<User> => {
  const { user: actor } = requireUser(ctx);
  const target = await loadUser(ctx, input.userId ?? actor.id);
  assertCan(ctx, "update", target);

  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
  };

  // Unique violations become ConflictError here, never in the repository or the router. The
  // profile fields above carry no unique constraint today; keep the translation when you add one.
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

export const changeRole = async (ctx: RequestContext, input: ChangeRoleInput): Promise<User> => {
  requireUser(ctx);
  if (!ctx.ability.can("changeRole", "User")) {
    throw new ForbiddenError("Not allowed to change roles");
  }

  return withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const target = await users.findById(input.userId);
    if (!target) {
      throw new NotFoundError("User", input.userId);
    }
    if (target.role === input.role) {
      return target;
    }
    // Stateful rule: the organisation must always keep at least one active admin.
    if (target.role === "admin" && (await users.countActiveAdmins()) <= 1) {
      throw new ConflictError("Cannot demote the last admin");
    }
    return users.updateRole(target.id, input.role);
  });
};

export const deactivate = async (ctx: RequestContext, userId: string): Promise<User> => {
  const { user: actor } = requireUser(ctx);
  if (!ctx.ability.can("delete", "User")) {
    throw new ForbiddenError("Not allowed to deactivate users");
  }
  if (actor.id === userId) {
    throw new ConflictError("You cannot deactivate your own account");
  }

  const deactivated = await withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const target = await users.findById(userId);
    if (!target) {
      throw new NotFoundError("User", userId);
    }
    if (target.role === "admin" && (await users.countActiveAdmins()) <= 1) {
      throw new ConflictError("Cannot deactivate the last admin");
    }
    return users.softDelete(target.id);
  });

  // Existing sessions die immediately; the Better Auth admin API checks the caller's own
  // session (admin) from the request headers.
  await ctx.auth.api.revokeUserSessions({ body: { userId }, headers: ctx.headers });

  return deactivated;
};

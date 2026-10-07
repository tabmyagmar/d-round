import { createUserRepository, translateDatabaseError, withTransaction } from "@repo/database";
import type { PageResult, Prisma, UniqueViolationError, User } from "@repo/database";
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";
import { ADMIN_ROLES } from "@repo/validation";
import type {
  ChangeRoleInput,
  InviteUserInput,
  ListUsersQuery,
  SortOrder,
  UpdateProfileInput,
  UserSortField,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";
import { webLinks } from "../../core/web-links";

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

/** `users.role` is a plain string column; the admin role set is `ADMIN_ROLES`. */
const isAdminRole = (role: string | null): boolean =>
  role !== null && (ADMIN_ROLES as readonly string[]).includes(role);

type RowAction = "read" | "update" | "status";

/** How a denied row action reads in the error message the client sees. */
const ROW_ACTION_PHRASES: Record<RowAction, string> = {
  read: "read",
  update: "update",
  status: "change the status of",
};

const assertCan = (ctx: RequestContext, action: RowAction, user: User): void => {
  if (!ctx.ability.can(action, prismaUserSubject(user))) {
    throw new ForbiddenError(`Not allowed to ${ROW_ACTION_PHRASES[action]} this user`);
  }
};

export const getById = async (ctx: RequestContext, userId: string): Promise<User> => {
  const user = await loadUser(ctx, userId);
  assertCan(ctx, "read", user);
  return user;
};

/** The allow-listed sort columns (`USER_SORT_FIELDS`) as Prisma orderings. */
const USER_ORDER_BY: Record<
  UserSortField,
  (direction: SortOrder) => Prisma.UserOrderByWithRelationInput
> = {
  name: (direction) => ({ name: direction }),
  email: (direction) => ({ email: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
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
    {
      orderBy: USER_ORDER_BY[query.sortBy](query.sortOrder),
      deleted: query.status === "deactivated" ? "only" : "exclude",
    },
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
    // Stateful rule: the organisation must always keep at least one active admin-role user.
    // Moving between admin roles (admin -> super_admin) keeps the count and is allowed.
    if (
      isAdminRole(target.role) &&
      !isAdminRole(input.role) &&
      (await users.countActiveAdmins(ADMIN_ROLES)) <= 1
    ) {
      throw new ConflictError("Cannot demote the last admin");
    }
    return users.updateRole(target.id, input.role);
  });
};

export const deactivate = async (ctx: RequestContext, userId: string): Promise<User> => {
  const { user: actor } = requireUser(ctx);
  // Deactivation is a status change (catalog action `status`), not a delete.
  if (!ctx.ability.can("status", "User")) {
    throw new ForbiddenError("Not allowed to change user status");
  }
  if (actor.id === userId) {
    throw new ConflictError("You cannot deactivate your own account");
  }

  return withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const target = await users.findById(userId);
    if (!target) {
      throw new NotFoundError("User", userId);
    }
    assertCan(ctx, "status", target);
    if (isAdminRole(target.role) && (await users.countActiveAdmins(ADMIN_ROLES)) <= 1) {
      throw new ConflictError("Cannot deactivate the last admin");
    }
    const softDeleted = await users.softDelete(target.id);
    // Existing sessions end in the same transaction, so a refused deactivation revokes nothing
    // and no Better Auth admin call (which checks the caller's own role) is needed.
    await users.deleteSessions(target.id);
    return softDeleted;
  });
};

/**
 * Lifts a deactivation (catalog row 1105, `status User`): clears the soft delete and the ban, so
 * the user can sign in again. Only deactivated users are found here, just as `deactivate` does
 * not find a user who already is.
 */
export const reactivate = async (ctx: RequestContext, userId: string): Promise<User> => {
  requireUser(ctx);
  if (!ctx.ability.can("status", "User")) {
    throw new ForbiddenError("Not allowed to change user status");
  }

  return withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const target = await users.findByIdIncludingDeleted(userId);
    if (!target?.deletedAt) {
      throw new NotFoundError("User", userId);
    }
    assertCan(ctx, "status", target);
    return users.restore(target.id);
  });
};

/** Better Auth rejects with an `APIError` whose `body.code` names the reason. */
const hasAuthErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  "body" in error &&
  typeof error.body === "object" &&
  error.body !== null &&
  "code" in error.body &&
  error.body.code === code;

/**
 * Mails a set-password link through Better Auth (token in `verifications`, outbox row via the
 * auth mail callback). The callback picks the wording: an invitation for a user without a
 * password, a reset otherwise. Server-side call: catalog grants decided before this runs.
 */
const mailPasswordLink = async (ctx: RequestContext, email: string): Promise<void> => {
  await ctx.auth.api.requestPasswordReset({
    body: { email, redirectTo: webLinks.newPassword(ctx.webOrigin) },
  });
};

/**
 * Creates a user without a password and mails the invitation; the user sets the first password
 * from the link (which also verifies the email). Catalog row 1101 (`create User`).
 */
export const invite = async (ctx: RequestContext, input: InviteUserInput): Promise<User> => {
  requireUser(ctx);
  if (!ctx.ability.can("create", "User")) {
    throw new ForbiddenError("Not allowed to create users");
  }

  let createdId: string;
  try {
    const created = await ctx.auth.api.createUser({
      body: { email: input.email, name: input.name, role: input.role },
    });
    createdId = created.user.id;
  } catch (error) {
    if (hasAuthErrorCode(error, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")) {
      throw new ConflictError("A user with this email already exists");
    }
    throw error;
  }

  // The user exists even if the mail cannot be queued; the admin re-sends from the user page.
  await mailPasswordLink(ctx, input.email);
  return loadUser(ctx, createdId);
};

/**
 * Mails the user a password link again: the invitation while they have no password, a reset
 * afterwards. Catalog row 1103 (`update User`) on that user; deactivated users are not found.
 */
export const sendPasswordReset = async (ctx: RequestContext, userId: string): Promise<void> => {
  requireUser(ctx);
  if (!ctx.ability.can("update", "User")) {
    throw new ForbiddenError("Not allowed to update users");
  }
  const target = await loadUser(ctx, userId);
  assertCan(ctx, "update", target);
  await mailPasswordLink(ctx, target.email);
};

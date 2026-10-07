import {
  createPermissionRepository,
  createUserRepository,
  translateDatabaseError,
  withTransaction,
} from "@repo/database";
import type {
  DbClient,
  PageResult,
  Prisma,
  UniqueViolationError,
  User,
  UserPermissionOverride,
} from "@repo/database";
import { accessibleUsersWhere, prismaUserSubject } from "@repo/permissions/server";
import {
  ADMIN_ROLES,
  assignableRoles,
  isOverridableRole,
  OVERRIDABLE_ROLES,
} from "@repo/validation";
import type {
  InviteUserInput,
  ListUsersQuery,
  Role,
  SortOrder,
  UpdateProfileInput,
  UpdateUserInput,
  UserSortField,
} from "@repo/validation";

import type { AuthUser, RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
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

/** A user as the detail and edit screens need it: the row and its effective permission keys. */
export type UserDetail = User & { permissionKeys: string[] };

/** Effective grants (role ∪ ALLOW − DENY, ADR 0003) as catalog keys, ascending. */
const withPermissionKeys = async (db: DbClient, user: User): Promise<UserDetail> => {
  const grants = await createPermissionRepository(db).findEffectiveGrants(user.id, user.role);
  return { ...user, permissionKeys: grants.map((grant) => grant.key) };
};

export const getById = async (ctx: RequestContext, userId: string): Promise<UserDetail> => {
  const user = await loadUser(ctx, userId);
  assertCan(ctx, "read", user);
  return withPermissionKeys(ctx.db, user);
};

/** Role and permission edits need catalog row 1106 (`changeRole User`). */
const assertMayChangeRoles = (ctx: RequestContext, message: string): void => {
  if (!ctx.ability.can("changeRole", "User")) {
    throw new ForbiddenError(message);
  }
};

/**
 * The legacy role picker as a rule (`assignableRoles`): the caller may give `role`, and — for an
 * existing user — may give the role the user holds now, so a manager never demotes an admin and
 * nobody changes a super_admin's role in the app.
 */
const assertAssignable = (actor: { role: Role }, role: string, currentRole?: string): void => {
  const assignable: readonly string[] = assignableRoles(actor.role);
  if (currentRole !== undefined && !assignable.includes(currentRole)) {
    throw new ForbiddenError(`Not allowed to change the role of a ${currentRole}`);
  }
  if (!assignable.includes(role)) {
    throw new ForbiddenError(`Not allowed to assign the role ${role}`);
  }
};

/**
 * The override rows for the selected child permissions of a user with `role`: a selected key the
 * role does not grant becomes ALLOW, a key the role grants but that was not selected becomes DENY;
 * everything else needs no row (ADR 0003). Only `OVERRIDABLE_ROLES` take overrides, and the caller
 * may only ALLOW what their own session grants them, so overrides never pass on more than the
 * caller holds.
 */
const overridesFor = async (
  db: DbClient,
  actor: AuthUser,
  role: string,
  selected: readonly string[],
): Promise<UserPermissionOverride[]> => {
  if (!isOverridableRole(role)) {
    throw new ConflictError(
      `Permissions can only be adjusted for ${OVERRIDABLE_ROLES.join(", ")} users`,
    );
  }
  const children = (await createPermissionRepository(db).findVisibleCatalog()).filter(
    (row) => row.parentKey !== null,
  );
  const known = new Set(children.map((row) => row.key));
  const unknown = [...new Set(selected.filter((key) => !known.has(key)))];
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown permissions: ${unknown.join(", ")}`);
  }
  const chosen = new Set(selected);
  const notHeld = children
    .filter(
      (row) =>
        chosen.has(row.key) &&
        !row.roles.some((grant) => grant.roleKey === role) &&
        !actor.permissions.some(
          (grant) => grant.action === row.action && grant.subject === row.modelName,
        ),
    )
    .map((row) => row.key);
  if (notHeld.length > 0) {
    throw new ForbiddenError(
      `Not allowed to grant permissions you do not hold: ${notHeld.join(", ")}`,
    );
  }
  return children.flatMap((row): UserPermissionOverride[] => {
    const granted = row.roles.some((grant) => grant.roleKey === role);
    if (chosen.has(row.key) && !granted) {
      return [{ permissionKey: row.key, effect: "ALLOW" }];
    }
    if (!chosen.has(row.key) && granted) {
      return [{ permissionKey: row.key, effect: "DENY" }];
    }
    return [];
  });
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

/**
 * 担当者情報編集: name, role and permission overrides of one user, saved together. Any field may be
 * omitted. Updating the row needs `update` on it; a role change or `permissionKeys` also needs
 * `changeRole` and a role the caller may assign. The last active admin-role user keeps an admin
 * role. Leaving an overridable role drops the user's overrides.
 */
export const update = async (ctx: RequestContext, input: UpdateUserInput): Promise<UserDetail> => {
  const { user: actor } = requireUser(ctx);

  return withTransaction(ctx.db, async ({ tx }) => {
    const users = createUserRepository(tx);
    const permissions = createPermissionRepository(tx);
    const target = await users.findById(input.userId);
    if (!target) {
      throw new NotFoundError("User", input.userId);
    }
    assertCan(ctx, "update", target);

    let updated = target;
    if (input.name !== undefined && input.name !== target.name) {
      updated = await users.updateProfile(target.id, { name: input.name });
    }

    const role = input.role ?? target.role;
    if (role !== target.role) {
      assertMayChangeRoles(ctx, "Not allowed to change roles");
      assertAssignable(actor, role, target.role);
      // Stateful rule: the organisation must always keep at least one active admin-role user.
      if (
        isAdminRole(target.role) &&
        !isAdminRole(role) &&
        (await users.countActiveAdmins(ADMIN_ROLES)) <= 1
      ) {
        throw new ConflictError("Cannot demote the last admin");
      }
      updated = await users.updateRole(target.id, role);
    }

    if (input.permissionKeys !== undefined) {
      assertMayChangeRoles(ctx, "Not allowed to change permissions");
      if (target.id === actor.id) {
        throw new ForbiddenError("You cannot change your own permissions");
      }
      assertAssignable(actor, role, target.role);
      const overrides = await overridesFor(tx, actor, role, input.permissionKeys);
      await permissions.replaceUserOverrides(target.id, overrides, actor.id);
    } else if (role !== target.role && !isOverridableRole(role)) {
      await permissions.replaceUserOverrides(target.id, [], actor.id);
    }

    return withPermissionKeys(tx, updated);
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
 * from the link (which also verifies the email). Catalog row 1101 (`create User`) and a role the
 * caller may assign; `permissionKeys` also need `changeRole` and an overridable role. Better Auth
 * creates the user, so the overrides are a second write: if it fails, the user exists with the
 * role's permissions and the error says to set them on the edit page.
 */
export const invite = async (ctx: RequestContext, input: InviteUserInput): Promise<UserDetail> => {
  const { user: actor } = requireUser(ctx);
  if (!ctx.ability.can("create", "User")) {
    throw new ForbiddenError("Not allowed to create users");
  }
  assertAssignable(actor, input.role);
  let overrides: UserPermissionOverride[] | undefined;
  if (input.permissionKeys !== undefined) {
    assertMayChangeRoles(ctx, "Not allowed to change permissions");
    overrides = await overridesFor(ctx.db, actor, input.role, input.permissionKeys);
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
  if (overrides) {
    const rows = overrides;
    try {
      await withTransaction(ctx.db, ({ tx }) =>
        createPermissionRepository(tx).replaceUserOverrides(createdId, rows, actor.id),
      );
    } catch (error) {
      throw new ConflictError(
        "The user was created, but their permissions were not saved; set them on the edit page",
        { cause: error },
      );
    }
  }
  return withPermissionKeys(ctx.db, await loadUser(ctx, createdId));
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

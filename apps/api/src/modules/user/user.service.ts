import {
  createPermissionRepository,
  createSourceRepository,
  createUserRepository,
  isUniqueViolation,
  translateDatabaseError,
  withTransaction,
} from "@repo/database";
import type {
  ChargerOption,
  DbClient,
  PageResult,
  Prisma,
  UniqueViolationError,
  User,
  UserPermissionOverride,
  UserProfileData,
  UserProfileUpdate,
  UserWithProfile,
} from "@repo/database";
import { accessibleUsersWhere, canUnscoped, prismaUserSubject } from "@repo/permissions/server";
import {
  ADMIN_ROLES,
  assignableRoles,
  employeeNumberOfSearch,
  fullName,
  isOverridableRole,
  OVERRIDABLE_ROLES,
} from "@repo/validation";
import type {
  ChargerOptionsInput,
  EmployeeNumberAvailableInput,
  InviteUserInput,
  ListUsersQuery,
  Role,
  SortOrder,
  UpdateProfileInput,
  UpdateUserInput,
  UserNameInput,
  UserProfileInput,
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

const loadUser = async (ctx: RequestContext, userId: string): Promise<UserWithProfile> => {
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

/**
 * A user as the detail and edit screens need it: the row, the 担当者 profile with its regions
 * (ADR 0007) and the effective permission keys.
 */
export type UserDetail = UserWithProfile & { permissionKeys: string[] };

/** Effective grants (role ∪ ALLOW − DENY, ADR 0003) as catalog keys, ascending. */
const withPermissionKeys = async (db: DbClient, user: UserWithProfile): Promise<UserDetail> => {
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

/**
 * The allow-listed sort columns (`USER_SORT_FIELDS`) as Prisma orderings. 社員番号 sorts through the
 * profile: users without one come last ascending and first descending (PostgreSQL's NULL order).
 */
const USER_ORDER_BY: Record<
  UserSortField,
  (direction: SortOrder) => Prisma.UserOrderByWithRelationInput
> = {
  employeeNumber: (direction) => ({ profile: { employeeNumber: direction } }),
  name: (direction) => ({ name: direction }),
  email: (direction) => ({ email: direction }),
  createdAt: (direction) => ({ createdAt: direction }),
};

export const list = async (
  ctx: RequestContext,
  query: ListUsersQuery,
): Promise<PageResult<UserWithProfile>> => {
  if (!ctx.ability.can("read", "User")) {
    throw new ForbiddenError("Not allowed to list users");
  }
  const filters: Prisma.UserWhereInput[] = [accessibleUsersWhere(ctx.ability, "read")];
  if (query.role) {
    filters.push({ role: query.role });
  }
  if (query.search) {
    const employeeNumber = employeeNumberOfSearch(query.search);
    filters.push({
      OR: [
        ...(employeeNumber === null ? [] : [{ profile: { employeeNumber } }]),
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { lastNameKana: { contains: query.search } },
        { firstNameKana: { contains: query.search } },
      ],
    });
  }
  if (query.areas?.length) {
    filters.push({ profile: { areas: { hasSome: query.areas } } });
  }
  if (query.regionCodes?.length) {
    filters.push({ profile: { regions: { some: { regionCode: { in: query.regionCodes } } } } });
  }
  if (query.positions?.length) {
    filters.push({ profile: { position: { in: query.positions } } });
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

const NAME_PARTS = ["lastName", "firstName", "lastNameKana", "firstNameKana"] as const;

/**
 * The profile changes for the name parts in `input`: the parts given, and the display name
 * `name` = "姓 名" (Better Auth's, used by the session and mails) whenever a part changes and both
 * 姓 and 名 are known — from the input or, for a part not given, from the stored user.
 */
type NamePatch = Partial<Record<(typeof NAME_PARTS)[number], string | undefined>>;

const nameChanges = (target: User, input: NamePatch): UserProfileUpdate => {
  const parts: Partial<UserNameInput> = {};
  for (const key of NAME_PARTS) {
    const value = input[key];
    if (value !== undefined) {
      parts[key] = value;
    }
  }
  if (Object.keys(parts).length === 0) {
    return {};
  }
  const lastName = parts.lastName ?? target.lastName;
  const firstName = parts.firstName ?? target.firstName;
  return {
    ...parts,
    ...(lastName && firstName ? { name: fullName({ lastName, firstName }) } : {}),
  };
};

/** The profile as the repository stores it: 退職日 as UTC midnight of that day (a DATE column). */
const toProfileData = (profile: UserProfileInput): UserProfileData => ({
  employeeNumber: profile.employeeNumber,
  departmentName: profile.departmentName,
  position: profile.position,
  retirementDate: profile.retirementDate === null ? null : new Date(profile.retirementDate),
  areas: profile.areas,
});

const EMPLOYEE_NUMBER_TAKEN = "This employee number is already in use";

/**
 * What a profile write needs beyond its schema: every region exists (reference data, ADR 0005) and
 * no other user holds the 社員番号. The invite runs it before Better Auth creates the user, so a
 * taken number never leaves a user half-created; the unique index still guards a race.
 */
const assertProfileWritable = async (
  db: DbClient,
  profile: UserProfileInput,
  userId?: string,
): Promise<void> => {
  const known = new Set(
    (await createSourceRepository(db).findRegions()).map((region) => region.code),
  );
  const unknown = profile.regionCodes.filter((code) => !known.has(code));
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown regions: ${unknown.join(", ")}`);
  }
  const holders = await createUserRepository(db).countProfilesByEmployeeNumber(
    profile.employeeNumber,
    userId,
  );
  if (holders > 0) {
    throw new ConflictError(EMPLOYEE_NUMBER_TAKEN);
  }
};

/** Writes the profile and its regions; a unique violation here is the 社員番号 race. */
const saveProfile = async (
  db: DbClient,
  userId: string,
  profile: UserProfileInput,
): Promise<void> => {
  const users = createUserRepository(db);
  try {
    await users.upsertProfile(userId, toProfileData(profile));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(EMPLOYEE_NUMBER_TAKEN, { cause: error });
    }
    throw error;
  }
  await users.replaceProfileRegions(userId, profile.regionCodes);
};

export const updateProfile = async (
  ctx: RequestContext,
  input: UpdateProfileInput,
): Promise<User> => {
  const { user: actor } = requireUser(ctx);
  const target = await loadUser(ctx, input.userId ?? actor.id);
  assertCan(ctx, "update", target);

  const data = nameChanges(target, input);
  if (Object.keys(data).length === 0) {
    return target;
  }

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
 * 担当者情報編集: name, profile, role and permission overrides of one user, saved together. Any
 * field may be omitted. Updating the row needs `update` on it; the profile also needs the
 * unconditional `update User` grant (the self rule covers the name only, ADR 0007); a role change
 * or `permissionKeys` also needs `changeRole` and a role the caller may assign. The last active
 * admin-role user keeps an admin role. Leaving an overridable role drops the user's overrides.
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

    const changes = nameChanges(target, input);
    if (Object.keys(changes).length > 0) {
      await users.updateProfile(target.id, changes);
    }

    if (input.profile !== undefined) {
      if (!canUnscoped(ctx.ability, "update", "User")) {
        throw new ForbiddenError("Not allowed to change profile fields");
      }
      await assertProfileWritable(tx, input.profile, target.id);
      await saveProfile(tx, target.id, input.profile);
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
      await users.updateRole(target.id, role);
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

    const saved = await users.findById(target.id);
    if (!saved) {
      throw new NotFoundError("User", target.id);
    }
    return withPermissionKeys(tx, saved);
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
 * creates the user with `name` = "姓 名"; the name parts, the profile and the overrides are a
 * second write before the mail: if it fails, the user exists without them and the error says to
 * complete the user and re-send the invitation. The profile's regions and 社員番号 are checked
 * before the user is created.
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
  await assertProfileWritable(ctx.db, input.profile);

  let createdId: string;
  try {
    const created = await ctx.auth.api.createUser({
      body: { email: input.email, name: fullName(input), role: input.role },
    });
    createdId = created.user.id;
  } catch (error) {
    if (hasAuthErrorCode(error, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")) {
      throw new ConflictError("A user with this email already exists");
    }
    throw error;
  }

  // Our own columns (the name parts, the profile) and the overrides, in one unit of work, before
  // the invitation goes out. Better Auth created the user, so a failure here leaves the user
  // without them and without a mail: the error says to complete the user and re-send.
  try {
    await withTransaction(ctx.db, async ({ tx }) => {
      await createUserRepository(tx).updateProfile(createdId, {
        lastName: input.lastName,
        firstName: input.firstName,
        lastNameKana: input.lastNameKana,
        firstNameKana: input.firstNameKana,
      });
      await saveProfile(tx, createdId, input.profile);
      if (overrides) {
        await createPermissionRepository(tx).replaceUserOverrides(createdId, overrides, actor.id);
      }
    });
  } catch (error) {
    throw new ConflictError(
      "The user was created, but their details were not saved; complete them on the edit page and send the invitation again",
      { cause: error },
    );
  }

  // The user exists even if the mail cannot be queued; the admin re-sends from the user page.
  await mailPasswordLink(ctx, input.email);
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

/** The most 担当者 options one lookup returns (one organisation's users of a few regions). */
export const CHARGER_OPTIONS_MAX = 200;

/**
 * The users the スタッフ form may offer as 担当者 (legacy getChargerUsers): active, never a
 * super_admin, covering one of `regionCodes`, among the users the caller may read, in kana order.
 */
export const chargerOptions = async (
  ctx: RequestContext,
  input: ChargerOptionsInput,
): Promise<ChargerOption[]> => {
  if (!ctx.ability.can("read", "User")) {
    throw new ForbiddenError("Not allowed to list users");
  }
  const superAdmin: Role = "super_admin";
  return createUserRepository(ctx.db).findChargerOptions(
    {
      AND: [
        accessibleUsersWhere(ctx.ability, "read"),
        { role: { not: superAdmin } },
        { profile: { regions: { some: { regionCode: { in: input.regionCodes } } } } },
      ],
    },
    CHARGER_OPTIONS_MAX,
  );
};

/**
 * Whether no other user holds the 社員番号 (legacy userNumberExists), so the forms can say so on
 * the field before saving. Needs the `read User` grant (not the self rule).
 */
export const isEmployeeNumberAvailable = async (
  ctx: RequestContext,
  input: EmployeeNumberAvailableInput,
): Promise<boolean> => {
  if (!canUnscoped(ctx.ability, "read", "User")) {
    throw new ForbiddenError("Not allowed to list users");
  }
  const holders = await createUserRepository(ctx.db).countProfilesByEmployeeNumber(
    input.employeeNumber,
    input.excludeUserId,
  );
  return holders === 0;
};

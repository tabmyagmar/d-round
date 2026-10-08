import type { Position, Prisma, SourceArea, User } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/** Every user read carries the 担当者 profile (ADR 0007) with its regions, ascending by code. */
const WITH_PROFILE = {
  profile: { include: { regions: { orderBy: { regionCode: "asc" } } } },
} satisfies Prisma.UserInclude;

/** A user with their HR profile (`null` until an invite or an edit adds it). */
export type UserWithProfile = Prisma.UserGetPayload<{ include: typeof WITH_PROFILE }>;

/** The HR fields of a 担当者 (`user_profiles`); the regions have their own method. */
export type UserProfileData = {
  employeeNumber: number;
  departmentName: string;
  position: Position;
  retirementDate: Date | null;
  areas: SourceArea[];
};

const CHARGER_OPTION_SELECT = {
  id: true,
  name: true,
  lastName: true,
  firstName: true,
  lastNameKana: true,
  firstNameKana: true,
} satisfies Prisma.UserSelect;

/** A user the スタッフ form may offer as 担当者. */
export type ChargerOption = Prisma.UserGetPayload<{ select: typeof CHARGER_OPTION_SELECT }>;

/** The name fields the user edits (姓 / 名 / セイ / メイ and the display name). */
export type UserProfileUpdate = {
  /** The display name; the service keeps it as "姓 名". */
  name?: string;
  lastName?: string;
  firstName?: string;
  lastNameKana?: string;
  firstNameKana?: string;
};

export type UserListOptions = {
  /** Default `createdAt desc`; `id` is appended as a tie-breaker so pages never overlap. */
  orderBy?: Prisma.UserOrderByWithRelationInput;
  /** `exclude` (default) lists active users, `only` the soft-deleted (deactivated) ones. */
  deleted?: "exclude" | "only";
};

/**
 * Pure data access for users. Read methods exclude soft-deleted rows unless the name or an
 * option says otherwise. Business rules (who may do what, last admin) live in the service.
 */
export const createUserRepository = (db: DbClient) => ({
  findById: (id: string): Promise<UserWithProfile | null> =>
    db.user.findFirst({ where: { id, deletedAt: null }, include: WITH_PROFILE }),

  findByIdIncludingDeleted: (id: string): Promise<UserWithProfile | null> =>
    db.user.findUnique({ where: { id }, include: WITH_PROFILE }),

  findByEmail: (email: string): Promise<UserWithProfile | null> =>
    db.user.findFirst({ where: { email, deletedAt: null }, include: WITH_PROFILE }),

  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.UserWhereInput = {},
    { orderBy = { createdAt: "desc" }, deleted = "exclude" }: UserListOptions = {},
  ): Promise<PageResult<UserWithProfile>> => {
    const page = normalizePage(params);
    const scoped: Prisma.UserWhereInput = {
      AND: [where, { deletedAt: deleted === "only" ? { not: null } : null }],
    };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where: scoped,
        include: WITH_PROFILE,
        ...toSkipTake(page),
        orderBy: [orderBy, { id: "asc" }],
      }),
      db.user.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  count: (where: Prisma.UserWhereInput = {}): Promise<number> =>
    db.user.count({ where: { AND: [where, { deletedAt: null }] } }),

  /** Active users holding any of `roles`; the caller passes the admin role set (`ADMIN_ROLES`). */
  countActiveAdmins: (roles: readonly string[]): Promise<number> =>
    db.user.count({ where: { role: { in: [...roles] }, deletedAt: null } }),

  updateProfile: (id: string, data: UserProfileUpdate): Promise<User> =>
    db.user.update({ where: { id }, data }),

  updateRole: (id: string, role: string): Promise<User> =>
    db.user.update({ where: { id }, data: { role } }),

  /** Creates the user's HR profile or replaces its fields (社員番号 is unique across users). */
  upsertProfile: (userId: string, data: UserProfileData) =>
    db.userProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data }),

  /** How many profiles hold `employeeNumber`, leaving out `exceptUserId`'s own. */
  countProfilesByEmployeeNumber: (employeeNumber: number, exceptUserId?: string): Promise<number> =>
    db.userProfile.count({
      where: { employeeNumber, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
    }),

  /** Sets the profile's regions to exactly `regionCodes`; run it in the profile's transaction. */
  replaceProfileRegions: async (userId: string, regionCodes: readonly number[]): Promise<void> => {
    await db.userProfileRegion.deleteMany({ where: { userId } });
    await db.userProfileRegion.createMany({
      data: regionCodes.map((regionCode) => ({ userId, regionCode })),
    });
  },

  /**
   * Active users matching `where` (the service composes it: regions, roles), in kana order —
   * users from before the name parts last — at most `take` of them.
   */
  findChargerOptions: (where: Prisma.UserWhereInput, take: number): Promise<ChargerOption[]> =>
    db.user.findMany({
      where: { AND: [where, { deletedAt: null }] },
      select: CHARGER_OPTION_SELECT,
      orderBy: [
        { lastNameKana: { sort: "asc", nulls: "last" } },
        { firstNameKana: { sort: "asc", nulls: "last" } },
        { name: "asc" },
        { id: "asc" },
      ],
      take,
    }),

  /** Deactivation: soft delete + Better Auth ban so the user can no longer sign in. */
  softDelete: (id: string): Promise<User> =>
    db.user.update({
      where: { id },
      data: { deletedAt: new Date(), banned: true, banReason: "deactivated" },
    }),

  /** Reverses `softDelete`: clears the soft delete and the ban, so the user can sign in again. */
  restore: (id: string): Promise<User> =>
    db.user.update({
      where: { id },
      data: { deletedAt: null, banned: false, banReason: null, banExpires: null },
    }),

  /**
   * True when the user has a password (Better Auth's `credential` account). A user an admin
   * created without one has none until they set it from the invitation link.
   */
  hasCredentialAccount: async (userId: string): Promise<boolean> =>
    (await db.account.count({ where: { userId, providerId: "credential" } })) > 0,

  /** Sets `emailVerified`; true when it changed (false when it already was verified). */
  markEmailVerified: async (id: string): Promise<boolean> =>
    (
      await db.user.updateMany({
        where: { id, emailVerified: false },
        data: { emailVerified: true },
      })
    ).count > 0,

  /** Ends every session of the user (Better Auth reads them from this table); returns the count. */
  deleteSessions: async (userId: string): Promise<number> =>
    (await db.session.deleteMany({ where: { userId } })).count,
});

export type UserRepository = ReturnType<typeof createUserRepository>;

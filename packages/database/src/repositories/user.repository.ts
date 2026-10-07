import type { Prisma, User } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/** Editable profile fields. Role and soft-delete have dedicated methods. */
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
  findById: (id: string): Promise<User | null> =>
    db.user.findFirst({ where: { id, deletedAt: null } }),

  findByIdIncludingDeleted: (id: string): Promise<User | null> =>
    db.user.findUnique({ where: { id } }),

  findByEmail: (email: string): Promise<User | null> =>
    db.user.findFirst({ where: { email, deletedAt: null } }),

  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.UserWhereInput = {},
    { orderBy = { createdAt: "desc" }, deleted = "exclude" }: UserListOptions = {},
  ): Promise<PageResult<User>> => {
    const page = normalizePage(params);
    const scoped: Prisma.UserWhereInput = {
      AND: [where, { deletedAt: deleted === "only" ? { not: null } : null }],
    };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where: scoped,
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

import type { Prisma, User } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/** Editable profile fields. Role and soft-delete have dedicated methods. */
export type UserProfileUpdate = {
  name?: string;
};

/**
 * Pure data access for users. Read methods exclude soft-deleted rows unless the name says
 * otherwise. Business rules (who may do what, last admin) live in the service.
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
  ): Promise<PageResult<User>> => {
    const page = normalizePage(params);
    const scoped: Prisma.UserWhereInput = { AND: [where, { deletedAt: null }] };
    const [items, total] = await Promise.all([
      db.user.findMany({ where: scoped, ...toSkipTake(page), orderBy: { createdAt: "desc" } }),
      db.user.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  count: (where: Prisma.UserWhereInput = {}): Promise<number> =>
    db.user.count({ where: { AND: [where, { deletedAt: null }] } }),

  countActiveAdmins: (): Promise<number> =>
    db.user.count({ where: { role: "admin", deletedAt: null } }),

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

import type { Permission } from "../generated/prisma/client";
import type { DbClient } from "../utils/transaction";

/** One effective grant: the catalog key and the action / subject (`modelName`) pair it maps to. */
export type EffectiveGrant = Pick<Permission, "key" | "action" | "modelName">;

/**
 * Pure data access for the permission catalog and its grants. A user's effective grants are
 * computed in one query: role grants ∪ the user's ALLOW rows − the user's DENY rows. A DENY only
 * removes a grant and an ALLOW only adds one; the user's rows never replace the role's. `visible`
 * is a UI filter and is not consulted. See docs/adr/0003-permissions.md.
 */
export const createPermissionRepository = (db: DbClient) => ({
  findEffectiveGrants: (userId: string, roleKey: string): Promise<EffectiveGrant[]> =>
    db.permission.findMany({
      where: {
        AND: [
          {
            OR: [
              { roles: { some: { roleKey } } },
              { users: { some: { userId, effect: "ALLOW" } } },
            ],
          },
          { users: { none: { userId, effect: "DENY" } } },
        ],
      },
      select: { key: true, action: true, modelName: true },
      orderBy: { key: "asc" },
    }),
});

export type PermissionRepository = ReturnType<typeof createPermissionRepository>;

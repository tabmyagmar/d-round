import type { Permission, PermissionEffect, UserPermission } from "../generated/prisma/client";
import type { DbClient } from "../utils/transaction";

/** One effective grant: the catalog key and the action / subject (`modelName`) pair it maps to. */
export type EffectiveGrant = Pick<Permission, "key" | "action" | "modelName">;

/** One visible catalog row and the roles that hold it (`role_permissions`), role keys ascending. */
export type CatalogPermission = Pick<
  Permission,
  "key" | "name" | "nameJp" | "parentKey" | "action" | "modelName"
> & { roles: { roleKey: string }[] };

/** One per-user override row: the permission and whether it adds (ALLOW) or removes (DENY) it. */
export type UserPermissionOverride = Pick<UserPermission, "permissionKey" | "effect">;

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

  /** The catalog a permission screen shows: `visible` rows only, parents and children, key order. */
  findVisibleCatalog: (): Promise<CatalogPermission[]> =>
    db.permission.findMany({
      where: { visible: true },
      select: {
        key: true,
        name: true,
        nameJp: true,
        parentKey: true,
        action: true,
        modelName: true,
        roles: { select: { roleKey: true }, orderBy: { roleKey: "asc" } },
      },
      orderBy: { key: "asc" },
    }),

  findUserOverrides: (userId: string): Promise<UserPermissionOverride[]> =>
    db.userPermission.findMany({
      where: { userId },
      select: { permissionKey: true, effect: true },
      orderBy: { permissionKey: "asc" },
    }),

  /**
   * Replaces every override row of the user with `overrides`; returns how many were written.
   * Two statements: run it on the transaction client of the unit of work that decided the rows.
   */
  replaceUserOverrides: async (
    userId: string,
    overrides: readonly { permissionKey: string; effect: PermissionEffect }[],
    assignedBy: string | null,
  ): Promise<number> => {
    await db.userPermission.deleteMany({ where: { userId } });
    if (overrides.length === 0) {
      return 0;
    }
    const { count } = await db.userPermission.createMany({
      data: overrides.map((override) => ({ userId, ...override, assignedBy })),
    });
    return count;
  },
});

export type PermissionRepository = ReturnType<typeof createPermissionRepository>;

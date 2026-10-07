import { createPermissionRepository } from "@repo/database";
import type { CatalogPermission } from "@repo/database";

import type { RequestContext } from "../../core/context";
import { ForbiddenError } from "../../core/errors";

/**
 * Permission module: the catalog a role / permission editor shows. Who may hold what is decided
 * by `role_permissions` and `user_permissions` (ADR 0003); this module only reads the catalog.
 */

export type PermissionCatalogEntry = {
  key: string;
  name: string;
  nameJp: string;
  action: string;
  modelName: string;
  /** Role keys whose grants include this permission, ascending. */
  roles: string[];
};

export type PermissionCatalogGroup = {
  key: string;
  name: string;
  nameJp: string;
  children: PermissionCatalogEntry[];
};

const toEntry = (row: CatalogPermission): PermissionCatalogEntry => ({
  key: row.key,
  name: row.name,
  nameJp: row.nameJp,
  action: row.action,
  modelName: row.modelName,
  roles: row.roles.map((role) => role.roleKey),
});

/** Parents (menu groups) in key order with their visible children; empty groups are dropped. */
const groupCatalog = (rows: readonly CatalogPermission[]): PermissionCatalogGroup[] => {
  const children = new Map<string, PermissionCatalogEntry[]>();
  for (const row of rows) {
    if (row.parentKey !== null) {
      children.set(row.parentKey, [...(children.get(row.parentKey) ?? []), toEntry(row)]);
    }
  }
  return rows
    .filter((row) => row.parentKey === null)
    .map((parent) => ({
      key: parent.key,
      name: parent.name,
      nameJp: parent.nameJp,
      children: children.get(parent.key) ?? [],
    }))
    .filter((group) => group.children.length > 0);
};

/** The visible catalog for whoever may change roles (catalog row 1106, `changeRole User`). */
export const catalog = async (ctx: RequestContext): Promise<PermissionCatalogGroup[]> => {
  if (!ctx.ability.can("changeRole", "User")) {
    throw new ForbiddenError("Not allowed to read the permission catalog");
  }
  return groupCatalog(await createPermissionRepository(ctx.db).findVisibleCatalog());
};

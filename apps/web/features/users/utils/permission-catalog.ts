import type { CheckboxGroup } from "@repo/ui/components/composed/grouped-checkbox-list";

import type { PermissionCatalog } from "@/features/users/types";

/** The child permission keys `role` holds through `role_permissions`, in catalog order. */
export const roleKeysOf = (catalog: PermissionCatalog, role: string): string[] =>
  catalog.flatMap((group) =>
    group.children.filter((child) => child.roles.includes(role)).map((child) => child.key),
  );

/** The catalog narrowed to `keys`: each group keeps its granted children, empty groups go. */
export const grantedGroups = (
  catalog: PermissionCatalog,
  keys: readonly string[],
): PermissionCatalog => {
  const granted = new Set(keys);
  return catalog
    .map((group) => ({
      ...group,
      children: group.children.filter((child) => granted.has(child.key)),
    }))
    .filter((group) => group.children.length > 0);
};

/** The catalog as checkbox groups for the permission editor; the role's own keys carry 標準. */
export const toCheckboxGroups = (
  catalog: PermissionCatalog,
  roleKeys: readonly string[],
): CheckboxGroup[] => {
  const defaults = new Set(roleKeys);
  return catalog.map((group) => ({
    key: group.key,
    label: group.nameJp,
    options: group.children.map((child) => ({
      value: child.key,
      label: child.nameJp,
      ...(defaults.has(child.key) ? { hint: "標準" } : {}),
    })),
  }));
};

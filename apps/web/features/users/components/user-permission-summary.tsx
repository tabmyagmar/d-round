import { Check } from "lucide-react";

import type { PermissionCatalog } from "@/features/users/types";
import { grantedGroups } from "@/features/users/utils/permission-catalog";

export type UserPermissionSummaryProps = {
  catalog: PermissionCatalog;
  /** The user's effective permission keys (`user.byId`). */
  permissionKeys: readonly string[];
};

/** Read-only list of what a user may do, grouped as the catalog groups it. */
export const UserPermissionSummary = ({ catalog, permissionKeys }: UserPermissionSummaryProps) => {
  const groups = grantedGroups(catalog, permissionKeys);
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">付与されている権限はありません</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium">{group.nameJp}</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {group.children.map((child) => (
              <li key={child.key} className="flex items-center gap-2">
                <Check aria-hidden className="size-3.5 text-success" />
                {child.nameJp}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

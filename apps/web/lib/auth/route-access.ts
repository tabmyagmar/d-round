import { canUnscoped } from "@repo/permissions";
import type { AppAbility } from "@repo/permissions";

import type { AppRoute } from "@/config/routes";

/**
 * THE route access rule — the sidebar (`visibleNavGroups`) and the server page guard both call it,
 * so the menu and the 403 cannot disagree. Permission routes ask `canUnscoped` ("on every row"),
 * never `ability.can`: the self rule makes `ability.can("read", "User")` true for everyone. UI
 * only — the API re-checks every request.
 */
export const canAccessRoute = (ability: AppAbility | null, route: AppRoute): boolean => {
  if (route.access === "public") {
    return true;
  }
  if (!ability) {
    return false;
  }
  if (route.access === "signed-in") {
    return true;
  }
  return canUnscoped(ability, route.access.action, route.access.subject);
};

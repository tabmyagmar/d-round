import { canUnscoped, defineAbilityFor } from "@repo/permissions";
import type { AbilityUser, AppAbility } from "@repo/permissions";

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

/** What the server page guard does with a request: render, show the 403, or send to login. */
export type RouteDecision = "allow" | "forbidden" | "sign-in";

/**
 * The page guard's decision as a pure function (`PageGuard` itself needs a Next request
 * context): public pages are open, anonymous visitors sign in, everyone else gets
 * `canAccessRoute` on their ability.
 */
export const routeDecision = (user: AbilityUser | null, route: AppRoute): RouteDecision => {
  if (route.access === "public") {
    return "allow";
  }
  if (!user) {
    return "sign-in";
  }
  return canAccessRoute(defineAbilityFor(user), route) ? "allow" : "forbidden";
};

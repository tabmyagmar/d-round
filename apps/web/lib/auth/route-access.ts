import { canUnscoped, defineAbilityFor } from "@repo/permissions";
import type { AbilityUser, AppAbility } from "@repo/permissions";

import type { AppRoute, Breadcrumb } from "@/config/routes";

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

/** A crumb of the header trail and whether the header may render it as a link. */
export type BreadcrumbEntry = Breadcrumb & { linkable: boolean };

/**
 * The header trail with the access rule applied: an intermediate crumb links to its page only when
 * `canAccessRoute` opens it, so `create Client` without `read Client` shows クライアント管理 as text
 * instead of a link to a 403. The last crumb is the current page and never links.
 */
export const breadcrumbLinks = (
  ability: AppAbility | null,
  trail: readonly Breadcrumb[],
): BreadcrumbEntry[] =>
  trail.map((crumb, index) => ({
    ...crumb,
    linkable: index < trail.length - 1 && canAccessRoute(ability, crumb.route),
  }));

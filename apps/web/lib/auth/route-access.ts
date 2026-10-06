import { canUnscoped, defineAbilityFor } from "@repo/permissions";
import type { AbilityUser, AppAbility } from "@repo/permissions";

import type { AppRoute, Breadcrumb } from "@/config/routes";

/**
 * THE route access rule — the sidebar (`visibleNavGroups`), the header breadcrumbs
 * (`breadcrumbLinks`) and the server page guard (`PageGuard`) all call it, so for one session the
 * menu, the crumb links and the 403 agree. Permission routes ask `canUnscoped` ("on every row"),
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

/** A crumb of the header trail: the current page, or a link only when `linkable`. */
export type BreadcrumbEntry = Breadcrumb & { current: boolean; linkable: boolean };

/**
 * The header trail with the access rule applied: the last crumb is the current page and never
 * links; an earlier crumb links to its page only when `canAccessRoute` opens it, so `create Client`
 * without `read Client` shows クライアント管理 as text instead of a link to a 403.
 */
export const breadcrumbLinks = (
  ability: AppAbility | null,
  trail: readonly Breadcrumb[],
): BreadcrumbEntry[] =>
  trail.map((crumb, index) => {
    const current = index === trail.length - 1;
    return { ...crumb, current, linkable: !current && canAccessRoute(ability, crumb.route) };
  });

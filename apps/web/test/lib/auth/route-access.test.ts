import { describe, expect, it } from "vitest";

import { defineAbilityFor } from "@repo/permissions";
import type { AbilityUser, AppAbility, PermissionGrant } from "@repo/permissions";

import { ALL_ROUTES, breadcrumbTrail, href, routes } from "@/config/routes";
import { breadcrumbLinks, canAccessRoute, routeDecision } from "@/lib/auth/route-access";
import { EVERY_GRANT, STAFF_GRANTS } from "@/test/support/grants";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

/** A signed-in user holding exactly these grants; the role never decides. */
const userWith = (permissions: readonly PermissionGrant[]): AbilityUser => ({
  id: ME_ID,
  role: "staff",
  permissions,
});

/** The ability of that user. */
const abilityWith = (permissions: readonly PermissionGrant[]): AppAbility =>
  defineAbilityFor(userWith(permissions));

describe("canAccessRoute", () => {
  it("opens a public route to anonymous visitors", () => {
    expect(canAccessRoute(null, routes.auth.login)).toBe(true);
  });

  it("keeps anonymous visitors out of signed-in and permission routes", () => {
    expect(canAccessRoute(null, routes.home)).toBe(false);
    expect(canAccessRoute(null, routes.client.list)).toBe(false);
  });

  it("opens signed-in routes to any signed-in user, even one without grants", () => {
    expect(canAccessRoute(abilityWith([]), routes.home)).toBe(true);
    expect(canAccessRoute(abilityWith([]), routes.profile)).toBe(true);
    expect(canAccessRoute(abilityWith([]), routes.settings.privacy)).toBe(true);
  });

  it("refuses the user pages to the self rule alone, although ability.can(read, User) is true", () => {
    const ability = abilityWith([]);
    // The self rule `can(["read", "update"], "User", { id })` makes the optimistic check pass —
    // the reason the access rule asks canUnscoped instead.
    expect(ability.can("read", "User")).toBe(true);
    expect(canAccessRoute(ability, routes.user.list)).toBe(false);
    expect(canAccessRoute(ability, routes.user.detail)).toBe(false);
    expect(canAccessRoute(ability, routes.user.update)).toBe(false);
  });

  it("opens the user list and detail to a user holding `read User`, not the create page", () => {
    const ability = abilityWith([{ action: "read", subject: "User" }]);
    expect(canAccessRoute(ability, routes.user.list)).toBe(true);
    expect(canAccessRoute(ability, routes.user.detail)).toBe(true);
    expect(canAccessRoute(ability, routes.user.create)).toBe(false);
  });

  it("does not open client.list with a grant on another subject", () => {
    expect(
      canAccessRoute(abilityWith([{ action: "read", subject: "Workflow" }]), routes.client.list),
    ).toBe(false);
  });

  it("does not open client.list with `create Client` alone, only client.create", () => {
    const ability = abilityWith([{ action: "create", subject: "Client" }]);
    expect(canAccessRoute(ability, routes.client.list)).toBe(false);
    expect(canAccessRoute(ability, routes.client.create)).toBe(true);
  });

  it("opens every permission route with exactly its grant and none without it", () => {
    for (const route of ALL_ROUTES) {
      if (typeof route.access === "string") {
        continue;
      }
      expect(canAccessRoute(abilityWith([route.access]), route), route.path).toBe(true);
      expect(canAccessRoute(abilityWith([]), route), route.path).toBe(false);
    }
  });
});

describe("routeDecision", () => {
  it("allows anonymous visitors on a public route", () => {
    expect(routeDecision(null, routes.auth.login)).toBe("allow");
  });

  it("sends anonymous visitors to sign-in on signed-in and permission routes", () => {
    expect(routeDecision(null, routes.home)).toBe("sign-in");
    expect(routeDecision(null, routes.client.list)).toBe("sign-in");
  });

  it("allows the seeded staff grants their pages and the signed-in pages", () => {
    const staff = userWith(STAFF_GRANTS);
    expect(routeDecision(staff, routes.client.list)).toBe("allow");
    expect(routeDecision(staff, routes.workflow.create)).toBe("allow");
    expect(routeDecision(staff, routes.home)).toBe("allow");
    expect(routeDecision(staff, routes.settings.privacy)).toBe("allow");
  });

  it("forbids the seeded staff grants the pages they hold no grant for", () => {
    const staff = userWith(STAFF_GRANTS);
    // The self rule alone does not open the user pages (canUnscoped, not ability.can).
    expect(routeDecision(staff, routes.user.list)).toBe("forbidden");
    expect(routeDecision(staff, routes.user.detail)).toBe("forbidden");
    expect(routeDecision(staff, routes.auditLog.list)).toBe("forbidden");
    expect(routeDecision(staff, routes.client.create)).toBe("forbidden");
  });

  it("forbids client.list once `read Client` is gone, as a user DENY row leaves the grants", () => {
    const denied = userWith(
      EVERY_GRANT.filter((grant) => !(grant.action === "read" && grant.subject === "Client")),
    );
    expect(routeDecision(denied, routes.client.list)).toBe("forbidden");
    expect(routeDecision(denied, routes.client.create)).toBe("allow");
  });
});

describe("breadcrumbLinks", () => {
  /** The trail of `pathname` as `[title, linkable]` pairs for a user holding these grants. */
  const linksFor = (permissions: readonly PermissionGrant[], pathname: string) =>
    breadcrumbLinks(abilityWith(permissions), breadcrumbTrail(pathname)).map(
      ({ title, linkable }) => [title, linkable],
    );

  it("links every intermediate crumb the seeded staff grants open, never the current page", () => {
    expect(linksFor(STAFF_GRANTS, href(routes.client.create))).toEqual([
      [routes.home.title, true],
      [routes.client.list.title, true],
      [routes.client.create.title, false],
    ]);
  });

  it("shows the list as text, not a link to a 403, to a user with `create Client` alone", () => {
    expect(linksFor([{ action: "create", subject: "Client" }], href(routes.client.create))).toEqual(
      [
        [routes.home.title, true],
        [routes.client.list.title, false],
        [routes.client.create.title, false],
      ],
    );
  });

  it("does not link 担当者管理 on the self rule alone, although ability.can(read, User) is true", () => {
    const path = href(routes.user.update, { id: ME_ID });
    expect(linksFor([{ action: "update", subject: "User" }], path)).toEqual([
      [routes.home.title, true],
      [routes.user.list.title, false],
      [routes.user.update.title, false],
    ]);
  });

  it("keeps the trail itself: titles, visited paths and routes", () => {
    const trail = breadcrumbTrail(href(routes.client.update, { id: "42" }));
    expect(breadcrumbLinks(abilityWith(EVERY_GRANT), trail)).toEqual(
      trail.map((crumb, index) => ({ ...crumb, linkable: index < trail.length - 1 })),
    );
  });
});

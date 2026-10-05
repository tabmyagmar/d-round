import { describe, expect, it } from "vitest";

import { defineAbilityFor } from "@repo/permissions";
import type { AppAbility, PermissionGrant } from "@repo/permissions";

import { ALL_ROUTES, routes } from "@/config/routes";
import { canAccessRoute } from "@/lib/auth/route-access";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

/** The ability of a user holding exactly these grants; the role never decides. */
const abilityWith = (permissions: PermissionGrant[]): AppAbility =>
  defineAbilityFor({ id: ME_ID, role: "staff", permissions });

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

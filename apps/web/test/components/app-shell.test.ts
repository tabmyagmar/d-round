import { describe, expect, it } from "vitest";

import { defineAbilityFor } from "@repo/permissions";
import type { PermissionGrant } from "@repo/permissions";

import { visibleNavItems } from "@/components/app-shell";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

const READ_USERS: PermissionGrant = { action: "read", subject: "User" };

/** The hrefs a user holding exactly these grants sees; the role never decides. */
const hrefsFor = (permissions: PermissionGrant[]): string[] =>
  visibleNavItems(defineAbilityFor({ id: ME_ID, role: "staff", permissions })).map(
    (item) => item.href,
  );

describe("visibleNavItems", () => {
  it("hides the users link without an unscoped read on User (the self rule is not enough)", () => {
    expect(hrefsFor([])).not.toContain("/users");
  });

  it("shows the users link to a user holding the `read User` grant", () => {
    expect(hrefsFor([READ_USERS])).toContain("/users");
  });

  it.each([
    ["with", [READ_USERS]],
    ["without", []],
  ] as const)("always shows dashboard and profile %s the grant", (_label, grants) => {
    const hrefs = hrefsFor([...grants]);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/profile");
  });
});

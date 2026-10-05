import { describe, expect, it } from "vitest";

import { defineAbilityFor } from "@repo/permissions";

import { visibleNavItems } from "@/components/app-shell";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

const hrefsFor = (role: "admin" | "staff"): string[] =>
  visibleNavItems(defineAbilityFor({ id: ME_ID, role, permissions: [] })).map((item) => item.href);

describe("visibleNavItems", () => {
  it("hides the users link from staff (they may only read their own row)", () => {
    expect(hrefsFor("staff")).not.toContain("/users");
  });

  it("shows the users link to an admin (unscoped read on User)", () => {
    expect(hrefsFor("admin")).toContain("/users");
  });

  it.each(["admin", "staff"] as const)("always shows dashboard and profile to %s", (role) => {
    const hrefs = hrefsFor(role);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/profile");
  });
});

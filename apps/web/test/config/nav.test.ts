import { describe, expect, it } from "vitest";

import { defineAbilityFor } from "@repo/permissions";
import type { AppAbility, PermissionGrant } from "@repo/permissions";

import { isActivePath, isNavItemActive, NAV_GROUPS, visibleNavGroups } from "@/config/nav";
import type { NavBranch, NavGroup, NavItem, NavLeaf } from "@/config/nav";
import { routes } from "@/config/routes";
import { EVERY_GRANT, STAFF_GRANTS } from "@/test/support/grants";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

const MASTER = "マスター管理";

/** The ability of a user holding exactly these grants; the role never decides. */
const abilityWith = (permissions: readonly PermissionGrant[]): AppAbility =>
  defineAbilityFor({ id: ME_ID, role: "staff", permissions });

/** A menu as plain data: leaf → its route title, branch → `{ [title]: child titles }`. */
const outline = (groups: readonly NavGroup[]) =>
  groups.map((group) => ({
    id: group.id,
    items: group.items.map((item) =>
      item.kind === "leaf"
        ? item.route.title
        : { [item.title]: item.children.map((child) => child.route.title) },
    ),
  }));

const menuFor = (permissions: readonly PermissionGrant[]) =>
  outline(visibleNavGroups(abilityWith(permissions)));

const SETTINGS_GROUP = {
  id: "settings",
  items: [routes.settings.privacy.title, routes.settings.help.title],
};

const allItems = (): NavItem[] => NAV_GROUPS.flatMap((group) => group.items);

const masterBranch = (): NavBranch =>
  allItems().find((item): item is NavBranch => item.kind === "branch" && item.title === MASTER)!;

const homeLeaf = (): NavLeaf =>
  allItems().find((item): item is NavLeaf => item.kind === "leaf" && item.route === routes.home)!;

describe("visibleNavGroups", () => {
  it("shows only ホーム and the 設定 group to a user without grants", () => {
    expect(menuFor([])).toEqual([{ id: "main", items: [routes.home.title] }, SETTINGS_GROUP]);
  });

  it("shows マスター管理 with exactly one child to a user holding `read User` alone", () => {
    expect(menuFor([{ action: "read", subject: "User" }])).toEqual([
      { id: "main", items: [routes.home.title, { [MASTER]: [routes.user.list.title] }] },
      SETTINGS_GROUP,
    ]);
  });

  it("shows the seeded staff grants their four main items and no マスター管理", () => {
    expect(menuFor(STAFF_GRANTS)).toEqual([
      {
        id: "main",
        items: [
          routes.home.title,
          routes.workflow.list.title,
          routes.client.list.title,
          routes.branch.list.title,
          routes.staff.list.title,
        ],
      },
      SETTINGS_GROUP,
    ]);
  });

  it("shows every item, all three master children included, to a user holding every grant", () => {
    const menu = menuFor(EVERY_GRANT);
    expect(menu).toEqual([
      {
        id: "main",
        items: [
          routes.home.title,
          routes.workflow.list.title,
          {
            [MASTER]: [
              routes.user.list.title,
              routes.workflowTemplate.list.title,
              routes.auditLog.list.title,
            ],
          },
          routes.client.list.title,
          routes.branch.list.title,
          routes.staff.list.title,
        ],
      },
      SETTINGS_GROUP,
    ]);
    expect(menu).toEqual(outline(NAV_GROUPS));
  });

  it("never mutates NAV_GROUPS: a narrow menu first does not shrink the full menu after it", () => {
    const before = outline(NAV_GROUPS);
    menuFor([]);
    menuFor([{ action: "read", subject: "User" }]);
    expect(menuFor(EVERY_GRANT)).toEqual(before);
    expect(outline(NAV_GROUPS)).toEqual(before);
  });
});

describe("isActivePath", () => {
  it("matches an exact path only by equality", () => {
    expect(isActivePath(routes.home.path, routes.home.path, true)).toBe(true);
    expect(isActivePath(routes.client.list.path, routes.home.path, true)).toBe(false);
  });

  it("activates a section on its own path and on the pages below it", () => {
    expect(isActivePath(routes.client.list.path, routes.client.list.path)).toBe(true);
    expect(isActivePath("/admin/client/42", routes.client.list.path)).toBe(true);
  });

  it("does not activate a section on a sibling path sharing its prefix", () => {
    expect(isActivePath("/admin/clientx", routes.client.list.path)).toBe(false);
  });
});

describe("isNavItemActive", () => {
  it("activates the マスター管理 branch on any of its children's pages", () => {
    expect(isNavItemActive(routes.auditLog.list.path, masterBranch())).toBe(true);
    expect(isNavItemActive("/admin/master/user/42", masterBranch())).toBe(true);
    expect(isNavItemActive(routes.client.list.path, masterBranch())).toBe(false);
  });

  it("keeps ホーム (exact) inactive below /admin", () => {
    expect(isNavItemActive(routes.home.path, homeLeaf())).toBe(true);
    expect(isNavItemActive(routes.client.list.path, homeLeaf())).toBe(false);
  });
});

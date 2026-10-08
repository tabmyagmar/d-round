import { describe, expect, it } from "vitest";

import type { PermissionGrant } from "@repo/permissions";

import { isActivePath, isNavItemActive, NAV_GROUPS, visibleNavGroups } from "@/config/nav";
import type { NavBranch, NavGroup, NavItem, NavLeaf } from "@/config/nav";
import { href, routes } from "@/config/routes";

import { abilityWith, EVERY_GRANT, AM_GRANTS } from "../support/grants";

const MASTER = "マスター管理";

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

const workflowLeaf = (): NavLeaf =>
  allItems().find(
    (item): item is NavLeaf => item.kind === "leaf" && item.route === routes.workflow.list,
  )!;

describe("visibleNavGroups", () => {
  it("shows only the 設定 group to a user without grants", () => {
    expect(menuFor([])).toEqual([SETTINGS_GROUP]);
  });

  it("shows マスター管理 with exactly one child to a user holding `read User` alone", () => {
    expect(menuFor([{ action: "read", subject: "User" }])).toEqual([
      { id: "main", items: [{ [MASTER]: [routes.user.list.title] }] },
      SETTINGS_GROUP,
    ]);
  });

  it("shows the seeded AM grants their four main items and no マスター管理", () => {
    expect(menuFor(AM_GRANTS)).toEqual([
      {
        id: "main",
        items: [
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

  it("activates ワークフロー on its own pages, not on ワークフロー管理 under /admin/master", () => {
    expect(isNavItemActive(href(routes.workflow.update, { id: "7" }), workflowLeaf())).toBe(true);
    expect(isNavItemActive(routes.workflowTemplate.list.path, workflowLeaf())).toBe(false);
  });
});

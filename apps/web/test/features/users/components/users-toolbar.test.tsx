// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UsersToolbar } from "@/features/users/components/users-toolbar";
import type { UserListFilters } from "@/features/users/utils/user-filters";

import { userWith } from "../../../support/grants";

afterEach(cleanup);

const NO_FILTERS: UserListFilters = { search: "", role: null, status: "active" };
const READ_USERS: readonly PermissionGrant[] = [{ action: "read", subject: "User" }];

const renderToolbar = (grants: readonly PermissionGrant[], filters = NO_FILTERS) => {
  const onChange = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <UsersToolbar filters={filters} onChange={onChange} />
    </AbilityProvider>,
  );
  return onChange;
};

describe("UsersToolbar", () => {
  it("links 担当者追加 to the create page for a caller who may create users", () => {
    renderToolbar([...READ_USERS, { action: "create", subject: "User" }]);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "担当者追加" }).getAttribute("href")).toBe(
      href(routes.user.create),
    );
  });

  it("hides 担当者追加 from a caller who may not create users", () => {
    renderToolbar(READ_USERS);

    expect(screen.queryByRole("button", { name: "担当者追加" })).toBeNull();
  });

  it("shows the search, and the active filters on the filter button and as tags", () => {
    renderToolbar(READ_USERS, { search: "amy", role: "admin", status: "deactivated" });

    expect(screen.getByRole("searchbox")).toHaveProperty("value", "amy");
    expect(screen.getByRole("button", { name: /フィルター/ }).textContent).toContain("2");
    expect(screen.getByText("アドミン")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
  });

  it("removes one filter through its tag", () => {
    const onChange = renderToolbar(READ_USERS, { search: "", role: "admin", status: "active" });

    screen.getByRole("button", { name: "アカウントタイプの絞り込みを解除" }).click();

    expect(onChange).toHaveBeenCalledWith({ role: null });
  });
});

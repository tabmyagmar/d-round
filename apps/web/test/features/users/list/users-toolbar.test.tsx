// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UsersToolbar } from "@/features/users/list/users-toolbar";
import type { UserListFilters } from "@/features/users/list/users-toolbar";

import { userWith } from "../../../support/grants";

afterEach(cleanup);

const NO_FILTERS: UserListFilters = { search: "", role: null, status: "active" };

const renderToolbar = (grants: readonly PermissionGrant[], filters = NO_FILTERS) =>
  render(
    <AbilityProvider user={userWith(grants)}>
      <UsersToolbar filters={filters} onChange={vi.fn()} />
    </AbilityProvider>,
  );

describe("UsersToolbar", () => {
  it("links 担当者追加 to the create page for a caller who may create users", () => {
    renderToolbar([
      { action: "read", subject: "User" },
      { action: "create", subject: "User" },
    ]);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "担当者追加" }).getAttribute("href")).toBe(
      href(routes.user.create),
    );
  });

  it("hides 担当者追加 from a caller who may not create users", () => {
    renderToolbar([{ action: "read", subject: "User" }]);

    expect(screen.queryByRole("button", { name: "担当者追加" })).toBeNull();
  });

  it("shows the filters in effect", () => {
    renderToolbar([{ action: "read", subject: "User" }], {
      search: "amy",
      role: "admin",
      status: "deactivated",
    });

    expect(screen.getByRole("searchbox")).toHaveProperty("value", "amy");
    expect(screen.getByText("アドミン")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
  });
});

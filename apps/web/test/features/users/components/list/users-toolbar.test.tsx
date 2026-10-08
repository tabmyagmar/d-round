// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UsersToolbar } from "@/features/users/components/list/users-toolbar";
import type { UserListFilters } from "@/features/users/utils/user-filters";
import { RowSelectionProvider } from "@/stores/row-selection";

import { userWith } from "../../../../support/grants";

beforeAll(() => {
  // jsdom has no matchMedia; the filter button's useIsMobile subscribes to one (desktop width here).
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(cleanup);

afterAll(() => {
  vi.unstubAllGlobals();
});

const NO_FILTERS: UserListFilters = {
  search: "",
  role: null,
  status: "active",
  areas: [],
  regionCodes: [],
  positions: [],
};
const READ_USERS: readonly PermissionGrant[] = [{ action: "read", subject: "User" }];

const renderToolbar = (
  grants: readonly PermissionGrant[],
  filters = NO_FILTERS,
  rowSelection: Record<string, true> = {},
) => {
  const onChange = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <RowSelectionProvider initialState={{ rowSelection }}>
        <UsersToolbar
          filters={filters}
          regions={[{ code: 4, name: "南関東" }]}
          onChange={onChange}
        />
      </RowSelectionProvider>
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
    renderToolbar(READ_USERS, {
      ...NO_FILTERS,
      search: "amy",
      role: "admin",
      status: "deactivated",
      regionCodes: [4],
    });

    expect(screen.getByRole("searchbox")).toHaveProperty("value", "amy");
    expect(screen.getByRole("button", { name: /フィルター/ }).textContent).toContain("3");
    expect(screen.getByText("アドミン")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
    expect(screen.getByText("南関東")).toBeDefined();
  });

  it("removes one filter through its tag", () => {
    const onChange = renderToolbar(READ_USERS, { ...NO_FILTERS, role: "admin" });

    screen.getByRole("button", { name: "アカウントタイプの絞り込みを解除" }).click();

    expect(onChange).toHaveBeenCalledWith({ role: null });
  });

  it("shows no selection line: the table's checkboxes are the only selection UI", () => {
    renderToolbar(READ_USERS, NO_FILTERS, { a: true, b: true });

    expect(screen.queryByText(/件選択中/)).toBeNull();
    expect(screen.queryByRole("button", { name: "選択解除" })).toBeNull();
  });
});

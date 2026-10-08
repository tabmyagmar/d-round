// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { StaffsToolbar } from "@/features/staff/components/list/staffs-toolbar";
import type { StaffListFilters } from "@/features/staff/utils/staff-filters";
import { RowSelectionProvider } from "@/stores/row-selection";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../../support/grants";

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

const NO_FILTERS: StaffListFilters = {
  search: "",
  statuses: [],
  genders: [],
  areas: [],
  regionCodes: [],
  prefectureCodes: [],
  employeeTypes: [],
};
const SUSPENDED_ONLY: StaffListFilters = { ...NO_FILTERS, statuses: ["SUSPENDED"] };

const renderToolbar = (
  grants: readonly PermissionGrant[],
  filters = NO_FILTERS,
  rowSelection: Record<string, true> = {},
) => {
  const onChange = vi.fn();
  const onDeleteSelected = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <RowSelectionProvider initialState={{ rowSelection }}>
        <StaffsToolbar
          filters={filters}
          names={{
            regions: [{ code: 4, name: "南関東" }],
            prefectures: [{ code: 13, name: "東京都" }],
          }}
          onChange={onChange}
          onDeleteSelected={onDeleteSelected}
        />
      </RowSelectionProvider>
    </AbilityProvider>,
  );
  return { onChange, onDeleteSelected };
};

describe("StaffsToolbar", () => {
  it("links スタッフ追加 to the create page for a caller who may create staff", () => {
    renderToolbar(EVERY_GRANT);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "スタッフ追加" }).getAttribute("href")).toBe(
      href(routes.staff.create),
    );
  });

  it("hides スタッフ追加 and 削除 from an AM, who may only read staff", () => {
    renderToolbar(AM_GRANTS, SUSPENDED_ONLY, { a: true });

    expect(screen.queryByRole("button", { name: "スタッフ追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "選択したスタッフを削除" })).toBeNull();
  });

  it("offers 削除 only while 停止 is filtered, as the legacy toolbar did", () => {
    renderToolbar(EVERY_GRANT, NO_FILTERS, { a: true });

    expect(screen.queryByRole("button", { name: "選択したスタッフを削除" })).toBeNull();
  });

  it("hands the selected ids to the caller, and waits for a selection", () => {
    const { onDeleteSelected } = renderToolbar(EVERY_GRANT, SUSPENDED_ONLY, { a: true, b: true });

    fireEvent.click(screen.getByRole("button", { name: "選択したスタッフを削除" }));

    expect(onDeleteSelected).toHaveBeenCalledWith(["a", "b"]);
    cleanup();
    renderToolbar(EVERY_GRANT, SUSPENDED_ONLY);
    expect(screen.getByRole("button", { name: "選択したスタッフを削除" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows the search, and the active filters on the filter button and as tags", () => {
    renderToolbar(AM_GRANTS, {
      ...NO_FILTERS,
      search: "101",
      genders: ["FEMALE"],
      regionCodes: [4],
      prefectureCodes: [13],
    });

    expect(screen.getByRole("searchbox")).toHaveProperty("value", "101");
    expect(screen.getByRole("button", { name: /フィルター/ }).textContent).toContain("3");
    expect(screen.getByText("女性")).toBeDefined();
    expect(screen.getByText("南関東")).toBeDefined();
    expect(screen.getByText("東京都")).toBeDefined();
  });

  it("removes one filter through its tag", () => {
    const { onChange } = renderToolbar(AM_GRANTS, { ...NO_FILTERS, genders: ["MALE"] });

    fireEvent.click(screen.getByRole("button", { name: "性別の絞り込みを解除" }));

    expect(onChange).toHaveBeenCalledWith({ genders: null });
  });
});

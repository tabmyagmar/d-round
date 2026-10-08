// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { BranchesToolbar } from "@/features/branches/components/list/branches-toolbar";
import type { BranchListFilters } from "@/features/branches/utils/branch-filters";
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

const NO_FILTERS: BranchListFilters = { search: "", statuses: [], areas: [], regionCodes: [] };
const SUSPENDED_ONLY: BranchListFilters = { ...NO_FILTERS, statuses: ["SUSPENDED"] };

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
        <BranchesToolbar
          filters={filters}
          names={{ regions: [{ code: 7, name: "関西" }] }}
          onChange={onChange}
          onDeleteSelected={onDeleteSelected}
        />
      </RowSelectionProvider>
    </AbilityProvider>,
  );
  return { onChange, onDeleteSelected };
};

describe("BranchesToolbar", () => {
  it("links 就業先部署追加 to the create page for a caller who may create branches", () => {
    renderToolbar(EVERY_GRANT);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "就業先部署追加" }).getAttribute("href")).toBe(
      href(routes.branch.create),
    );
  });

  it("hides 就業先部署追加 and 削除 from an AM, who may only read branches", () => {
    renderToolbar(AM_GRANTS, SUSPENDED_ONLY, { a: true });

    expect(screen.queryByRole("button", { name: "就業先部署追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "選択した就業先部署を削除" })).toBeNull();
  });

  it("offers 削除 for the selection only while 停止 is filtered, as the legacy toolbar did", () => {
    renderToolbar(EVERY_GRANT, NO_FILTERS, { a: true });
    expect(screen.queryByRole("button", { name: "選択した就業先部署を削除" })).toBeNull();
    cleanup();

    const { onDeleteSelected } = renderToolbar(EVERY_GRANT, SUSPENDED_ONLY, { a: true, b: true });
    fireEvent.click(screen.getByRole("button", { name: "選択した就業先部署を削除" }));

    expect(onDeleteSelected).toHaveBeenCalledWith(["a", "b"]);
  });

  it("shows the active filters as tags and removes one through its tag", () => {
    const { onChange } = renderToolbar(AM_GRANTS, { ...NO_FILTERS, regionCodes: [7] });

    expect(screen.getByText("関西")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "地域の絞り込みを解除" }));

    expect(onChange).toHaveBeenCalledWith({ regionCodes: null });
  });
});

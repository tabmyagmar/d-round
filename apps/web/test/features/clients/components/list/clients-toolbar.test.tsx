// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { ClientsToolbar } from "@/features/clients/components/list/clients-toolbar";
import type { ClientListFilters } from "@/features/clients/utils/client-filters";
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

const NO_FILTERS: ClientListFilters = {
  search: "",
  statuses: [],
  areas: [],
  regionCodes: [],
  orderTypes: [],
};
const SUSPENDED_ONLY: ClientListFilters = { ...NO_FILTERS, statuses: ["SUSPENDED"] };

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
        <ClientsToolbar
          filters={filters}
          names={{ regions: [{ code: 4, name: "南関東" }] }}
          onChange={onChange}
          onDeleteSelected={onDeleteSelected}
        />
      </RowSelectionProvider>
    </AbilityProvider>,
  );
  return { onChange, onDeleteSelected };
};

describe("ClientsToolbar", () => {
  it("links クライアント追加 to the create page for a caller who may create clients", () => {
    renderToolbar(EVERY_GRANT);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "クライアント追加" }).getAttribute("href")).toBe(
      href(routes.client.create),
    );
  });

  it("hides クライアント追加 and 削除 from an AM, who may only read clients", () => {
    renderToolbar(AM_GRANTS, SUSPENDED_ONLY, { a: true });

    expect(screen.queryByRole("button", { name: "クライアント追加" })).toBeNull();
    expect(screen.queryByRole("button", { name: "選択したクライアントを削除" })).toBeNull();
  });

  it("offers 削除 only while 停止 is filtered, as the legacy toolbar did", () => {
    renderToolbar(EVERY_GRANT, NO_FILTERS, { a: true });

    expect(screen.queryByRole("button", { name: "選択したクライアントを削除" })).toBeNull();
  });

  it("hands the selected ids to the caller, and waits for a selection", () => {
    const { onDeleteSelected } = renderToolbar(EVERY_GRANT, SUSPENDED_ONLY, { a: true, b: true });

    fireEvent.click(screen.getByRole("button", { name: "選択したクライアントを削除" }));

    expect(onDeleteSelected).toHaveBeenCalledWith(["a", "b"]);
    cleanup();
    renderToolbar(EVERY_GRANT, SUSPENDED_ONLY);
    expect(screen.getByRole("button", { name: "選択したクライアントを削除" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows the search, and the active filters on the filter button and as tags", () => {
    renderToolbar(AM_GRANTS, {
      ...NO_FILTERS,
      search: "101",
      regionCodes: [4],
      orderTypes: ["SPOT_WORK"],
    });

    expect(screen.getByRole("searchbox")).toHaveProperty("value", "101");
    expect(screen.getByRole("button", { name: /フィルター/ }).textContent).toContain("2");
    expect(screen.getByText("南関東")).toBeDefined();
    expect(screen.getByText("スポット")).toBeDefined();
  });

  it("removes one filter through its tag", () => {
    const { onChange } = renderToolbar(AM_GRANTS, { ...NO_FILTERS, orderTypes: ["DISPATCH"] });

    fireEvent.click(screen.getByRole("button", { name: "受注区分の絞り込みを解除" }));

    expect(onChange).toHaveBeenCalledWith({ orderTypes: null });
  });
});

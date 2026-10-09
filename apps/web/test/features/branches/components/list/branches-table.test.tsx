// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { BranchesTable } from "@/features/branches/components/list/branches-table";
import type { BranchRow } from "@/features/branches/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { EVERY_GRANT, userWith } from "../../../../support/grants";
import { branchRow } from "../../fixtures";

afterEach(cleanup);

const onePage = (total: number) => ({
  page: 1,
  totalPages: 1,
  total,
  hasPrev: false,
  hasNext: false,
  onPageChange: vi.fn(),
});

const renderTable = (rows: BranchRow[], pagination?: ReturnType<typeof onePage>) =>
  render(
    <AbilityProvider user={userWith(EVERY_GRANT)}>
      <RowSelectionProvider>
        <BranchesTable
          data={rows}
          isLoading={false}
          sorting={{ state: [], onChange: vi.fn() }}
          pagination={pagination}
          onChangeStatus={vi.fn()}
          onDelete={vi.fn()}
        />
      </RowSelectionProvider>
    </AbilityProvider>,
  );

describe("BranchesTable", () => {
  it("titles the card 全就業先部署数 with the total from the page result", () => {
    renderTable([branchRow()], onePage(12));

    expect(screen.getByText("全就業先部署数").textContent).toBe("全就業先部署数12");
  });

  it("shows the legacy columns in the legacy order, 番号, 名 and クライアント名 sortable", () => {
    renderTable([branchRow()]);

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "",
      "就業先番号",
      "就業先名",
      "クライアント名",
      "担当者",
      "郵便番号・住所",
      "ステータス",
      "操作",
    ]);
    expect(
      headers
        .filter((header) => within(header).queryByRole("button") !== null)
        .map((header) => header.textContent),
    ).toEqual(["就業先番号", "就業先名", "クライアント名"]);
  });

  it("links the name to the detail page with the reading underneath, and shows the client", () => {
    const branch = branchRow();
    renderTable([branch]);

    expect(screen.getByRole("link", { name: "新宿店" }).getAttribute("href")).toBe(
      href(routes.branch.detail, { id: branch.id }),
    );
    expect(screen.getByText("シンジュクテン")).toBeDefined();
    expect(screen.getByText("株式会社テスト")).toBeDefined();
  });

  it("shows the 担当者, the 部署's whole address and the status, and — where there are none", () => {
    renderTable([
      branchRow({ status: "INACTIVE" }),
      branchRow({ name: "空店", chargers: [], address: null }),
    ]);

    const [, full, empty] = screen.getAllByRole("row");
    expect(within(full!).getByText("佐藤 一郎")).toBeDefined();
    expect(within(full!).getByText("〒160-0022")).toBeDefined();
    expect(within(full!).getByText("東京都新宿区新宿1-2-3")).toBeDefined();
    expect(within(full!).getByText("保留")).toBeDefined();
    expect(within(empty!).getAllByText("—")).toHaveLength(2);
  });

  it("selects a row with its checkbox, kept in the list's row selection", () => {
    renderTable([branchRow(), branchRow({ name: "渋谷店" })]);
    fireEvent.click(screen.getByRole("checkbox", { name: "新宿店を選択" }));

    expect(
      screen
        .getByRole("checkbox", { name: "このページの就業先部署をすべて選択" })
        .getAttribute("aria-checked"),
    ).toBe("mixed");
  });
});

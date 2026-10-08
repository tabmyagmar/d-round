// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { StaffsTable } from "@/features/staff/components/list/staffs-table";
import type { StaffRow } from "@/features/staff/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { EVERY_GRANT, userWith } from "../../../../support/grants";
import { staffRow } from "../../fixtures";

afterEach(cleanup);

const onePage = (total: number) => ({
  page: 1,
  totalPages: 1,
  total,
  hasPrev: false,
  hasNext: false,
  onPageChange: vi.fn(),
});

const renderTable = (rows: StaffRow[], pagination?: ReturnType<typeof onePage>) =>
  render(
    <AbilityProvider user={userWith(EVERY_GRANT)}>
      <RowSelectionProvider>
        <StaffsTable
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

describe("StaffsTable", () => {
  it("titles the card 全スタッフ数 with the total from the page result", () => {
    renderTable([staffRow()], onePage(12));

    expect(screen.getByText("全スタッフ数").textContent).toBe("全スタッフ数12");
  });

  it("shows the legacy columns in the legacy order", () => {
    renderTable([staffRow()]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "スタッフ番号",
      "スタッフ名",
      "担当者",
      "エリア",
      "地域",
      "支店名",
      "ステータス",
      "操作",
    ]);
  });

  it("lets スタッフ番号 and スタッフ名 be sorted and nothing else", () => {
    renderTable([staffRow()]);

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => within(header).queryByRole("button") !== null)
      .map((header) => header.textContent);
    expect(sortable).toEqual(["スタッフ番号", "スタッフ名"]);
  });

  it("links the name to the detail page, with the reading underneath", () => {
    const hanako = staffRow();
    renderTable([hanako]);

    expect(screen.getByRole("link", { name: "山田 花子" }).getAttribute("href")).toBe(
      href(routes.staff.detail, { id: hanako.id }),
    );
    expect(screen.getByText("ヤマダ ハナコ")).toBeDefined();
  });

  it("shows the number, 担当者, エリア, 地域, 支店名 and status, and — where there are none", () => {
    renderTable([
      staffRow({ employeeNumber: 7, areas: ["EAST", "WEST"], status: "INACTIVE" }),
      staffRow({ areas: [], regions: [], chargers: [], branchName: null }),
    ]);

    const [, full, empty] = screen.getAllByRole("row");
    expect(within(full!).getByText("7")).toBeDefined();
    expect(within(full!).getByText("佐藤 一郎")).toBeDefined();
    expect(within(full!).getByText("東日本、西日本")).toBeDefined();
    expect(within(full!).getByText("南関東")).toBeDefined();
    expect(within(full!).getByText("新宿支店")).toBeDefined();
    expect(within(full!).getByText("保留")).toBeDefined();
    expect(within(empty!).getAllByText("—")).toHaveLength(4);
  });

  it("selects a row with its checkbox, kept in the list's row selection", () => {
    renderTable([staffRow(), staffRow({ lastName: "鈴木" })]);
    fireEvent.click(screen.getByRole("checkbox", { name: "山田 花子を選択" }));

    expect(
      screen.getByRole("checkbox", { name: "山田 花子を選択" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: "このページのスタッフをすべて選択" })
        .getAttribute("aria-checked"),
    ).toBe("mixed");
  });
});

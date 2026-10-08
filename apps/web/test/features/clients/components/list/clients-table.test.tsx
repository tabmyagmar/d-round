// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { ClientsTable } from "@/features/clients/components/list/clients-table";
import type { ClientRow } from "@/features/clients/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { EVERY_GRANT, userWith } from "../../../../support/grants";
import { clientRow } from "../../fixtures";

afterEach(cleanup);

const onePage = (total: number) => ({
  page: 1,
  totalPages: 1,
  total,
  hasPrev: false,
  hasNext: false,
  onPageChange: vi.fn(),
});

const renderTable = (rows: ClientRow[], pagination?: ReturnType<typeof onePage>) =>
  render(
    <AbilityProvider user={userWith(EVERY_GRANT)}>
      <RowSelectionProvider>
        <ClientsTable
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

describe("ClientsTable", () => {
  it("titles the card 全クライアント数 with the total from the page result", () => {
    renderTable([clientRow()], onePage(12));

    expect(screen.getByText("全クライアント数").textContent).toBe("全クライアント数12");
  });

  it("shows the legacy columns in the legacy order", () => {
    renderTable([clientRow()]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "クライアント番号",
      "クライアント名",
      "担当者",
      "受注区分",
      "郵便番号・住所",
      "電話番号",
      "ステータス",
      "操作",
    ]);
  });

  it("lets クライアント番号 and クライアント名 be sorted and nothing else", () => {
    renderTable([clientRow()]);

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => within(header).queryByRole("button") !== null)
      .map((header) => header.textContent);
    expect(sortable).toEqual(["クライアント番号", "クライアント名"]);
  });

  it("links the name to the detail page", () => {
    const client = clientRow();
    renderTable([client]);

    expect(screen.getByRole("link", { name: "株式会社テスト" }).getAttribute("href")).toBe(
      href(routes.client.detail, { id: client.id }),
    );
  });

  it("shows the 担当者, 受注区分, the whole address and the status, and — where there are none", () => {
    renderTable([
      clientRow({ number: 7, orderTypes: ["CONTRACT_WORK", "DISPATCH"], status: "INACTIVE" }),
      clientRow({ name: "株式会社空", chargers: [], orderTypes: [], address: null }),
    ]);

    const [, full, empty] = screen.getAllByRole("row");
    expect(within(full!).getByText("7")).toBeDefined();
    expect(within(full!).getByText("佐藤 一郎")).toBeDefined();
    expect(within(full!).getByText("業務請負、派遣")).toBeDefined();
    expect(within(full!).getByText("〒160-0022")).toBeDefined();
    expect(within(full!).getByText("東京都新宿区新宿1-2-3")).toBeDefined();
    expect(within(full!).getByText("03-1234-5678")).toBeDefined();
    expect(within(full!).getByText("保留")).toBeDefined();
    expect(within(empty!).getAllByText("—")).toHaveLength(3);
  });

  it("selects a row with its checkbox, kept in the list's row selection", () => {
    renderTable([clientRow(), clientRow({ name: "株式会社別" })]);
    fireEvent.click(screen.getByRole("checkbox", { name: "株式会社テストを選択" }));

    expect(
      screen.getByRole("checkbox", { name: "株式会社テストを選択" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("checkbox", { name: "このページのクライアントをすべて選択" })
        .getAttribute("aria-checked"),
    ).toBe("mixed");
  });
});

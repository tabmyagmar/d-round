// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UsersTable } from "@/features/users/components/list/users-table";
import type { UserRow } from "@/features/users/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { EVERY_GRANT, userWith } from "../../../../support/grants";
import { userProfile, userRow } from "../../fixtures";

afterEach(cleanup);

const onePage = (total: number) => ({
  page: 1,
  totalPages: 1,
  total,
  hasPrev: false,
  hasNext: false,
  onPageChange: vi.fn(),
});

const renderTable = (rows: UserRow[], pagination?: ReturnType<typeof onePage>) =>
  render(
    <AbilityProvider user={userWith(EVERY_GRANT)}>
      <RowSelectionProvider>
        <UsersTable
          data={rows}
          isLoading={false}
          sorting={{ state: [], onChange: vi.fn() }}
          pagination={pagination}
          onToggleStatus={vi.fn()}
        />
      </RowSelectionProvider>
    </AbilityProvider>,
  );

describe("UsersTable", () => {
  it("titles the card 全担当者数 with the total from the page result", () => {
    renderTable([userRow()], onePage(7));

    expect(screen.getByText("全担当者数").textContent).toBe("全担当者数7");
  });

  it("shows the legacy columns in the legacy order", () => {
    renderTable([userRow()]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "社員番号",
      "氏名",
      "メールアドレス",
      "エリア",
      "地域",
      "アカウントタイプ",
      "ステータス",
      "操作",
    ]);
  });

  it("shows the 社員番号, エリア and 地域 of the profile, and — without one", () => {
    renderTable([
      userRow({
        name: "With",
        profile: userProfile({ employeeNumber: 42, areas: ["EAST", "WEST"] }),
      }),
      userRow({ name: "Without", profile: null }),
    ]);

    const [, withProfile, withoutProfile] = screen.getAllByRole("row");
    expect(within(withProfile!).getByText("42")).toBeDefined();
    expect(within(withProfile!).getByText("東日本、西日本")).toBeDefined();
    expect(within(withProfile!).getByText("南関東")).toBeDefined();
    expect(within(withoutProfile!).getAllByText("—")).toHaveLength(3);
  });

  it("lets 社員番号, 氏名 and メールアドレス be sorted and nothing else", () => {
    renderTable([userRow()]);

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => within(header).queryByRole("button") !== null)
      .map((header) => header.textContent);
    expect(sortable).toEqual(["社員番号", "氏名", "メールアドレス"]);
  });

  it("links an active user's name to the detail page and labels the role and status", () => {
    const amy = userRow({ name: "Amy", role: "admin" });
    renderTable([amy]);

    expect(screen.getByRole("link", { name: "Amy" }).getAttribute("href")).toBe(
      href(routes.user.detail, { id: amy.id }),
    );
    expect(screen.getByText("アドミン")).toBeDefined();
    expect(screen.getByText("利用中")).toBeDefined();
  });

  it("shows the katakana reading under the name", () => {
    renderTable([userRow({ name: "山田 太郎", lastNameKana: "ヤマダ", firstNameKana: "タロウ" })]);

    expect(screen.getByText("ヤマダ タロウ")).toBeDefined();
  });

  it("shows a deactivated user as 停止, without a link to a detail page it cannot open", () => {
    renderTable([userRow({ name: "Bob", deletedAt: new Date() })]);

    expect(screen.getByText("停止")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Bob" })).toBeNull();
  });

  it("selects a row with its checkbox, kept in the list's row selection", () => {
    renderTable([userRow({ name: "Amy" }), userRow({ name: "Bob" })]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Amyを選択" }));

    expect(screen.getByRole("checkbox", { name: "Amyを選択" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(
      screen
        .getByRole("checkbox", { name: "このページの担当者をすべて選択" })
        .getAttribute("aria-checked"),
    ).toBe("mixed");
  });

  it("checks the header box, not mixed, once every user on the page is selected", () => {
    renderTable([userRow({ name: "Amy" }), userRow({ name: "Bob" })]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Amyを選択" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bobを選択" }));

    expect(
      screen
        .getByRole("checkbox", { name: "このページの担当者をすべて選択" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});

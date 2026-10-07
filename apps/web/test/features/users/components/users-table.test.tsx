// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UsersTable } from "@/features/users/components/users-table";
import { UsersStoreProvider } from "@/features/users/stores/users-store-provider";
import type { UserRow } from "@/features/users/types";

import { EVERY_GRANT, userWith } from "../../../support/grants";
import { userRow } from "../fixtures";

afterEach(cleanup);

const renderTable = (rows: UserRow[]) =>
  render(
    <AbilityProvider user={userWith(EVERY_GRANT)}>
      <UsersStoreProvider>
        <UsersTable
          data={rows}
          isLoading={false}
          sorting={{ state: [], onChange: vi.fn() }}
          pagination={undefined}
          onToggleStatus={vi.fn()}
        />
      </UsersStoreProvider>
    </AbilityProvider>,
  );

describe("UsersTable", () => {
  it("shows the legacy columns in the legacy order", () => {
    renderTable([userRow()]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "氏名",
      "メールアドレス",
      "アカウントタイプ",
      "ステータス",
      "操作",
    ]);
  });

  it("lets 氏名 and メールアドレス be sorted and nothing else", () => {
    renderTable([userRow()]);

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => within(header).queryByRole("button") !== null)
      .map((header) => header.textContent);
    expect(sortable).toEqual(["氏名", "メールアドレス"]);
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

  it("shows a deactivated user as 停止, without a link to a detail page it cannot open", () => {
    renderTable([userRow({ name: "Bob", deletedAt: new Date() })]);

    expect(screen.getByText("停止")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Bob" })).toBeNull();
  });

  it("selects a row with its checkbox, kept in the users store", () => {
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
});

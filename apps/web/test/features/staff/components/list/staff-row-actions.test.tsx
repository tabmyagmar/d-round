// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { StaffRowActions } from "@/features/staff/components/list/staff-row-actions";
import type { StaffRow } from "@/features/staff/types";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../../support/grants";
import { staffRow } from "../../fixtures";

afterEach(cleanup);

/** Renders the menu for `staff` under `grants` and opens it; returns the two spies. */
const openMenu = async (staff: StaffRow, grants: readonly PermissionGrant[]) => {
  const onChangeStatus = vi.fn();
  const onDelete = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <StaffRowActions staff={staff} onChangeStatus={onChangeStatus} onDelete={onDelete} />
    </AbilityProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "山田 花子の操作" }));
  await screen.findByRole("menu");
  return { onChangeStatus, onDelete };
};

const itemNames = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("StaffRowActions", () => {
  it("offers detail, edit, status change and delete to a caller holding every grant", async () => {
    const hanako = staffRow();
    await openMenu(hanako, EVERY_GRANT);

    expect(itemNames()).toEqual([
      "スタッフ情報詳細",
      "スタッフ情報編集",
      "ステータス変更",
      "スタッフ削除",
    ]);
    expect(screen.getByRole("menuitem", { name: "スタッフ情報編集" }).getAttribute("href")).toBe(
      href(routes.staff.update, { id: hanako.id }),
    );
  });

  it("offers only the detail page to an AM, who may only read staff", async () => {
    await openMenu(staffRow(), AM_GRANTS);

    expect(itemNames()).toEqual(["スタッフ情報詳細"]);
  });

  it("keeps スタッフ削除 disabled until the staff is 停止", async () => {
    await openMenu(staffRow({ status: "INACTIVE" }), EVERY_GRANT);

    expect(
      screen.getByRole("menuitem", { name: "スタッフ削除" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("hands a 停止 staff to the caller for ステータス変更 and スタッフ削除", async () => {
    const hanako = staffRow({ status: "SUSPENDED" });
    const { onChangeStatus, onDelete } = await openMenu(hanako, EVERY_GRANT);

    fireEvent.click(screen.getByRole("menuitem", { name: "スタッフ削除" }));
    fireEvent.click(screen.getByRole("button", { name: "山田 花子の操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "ステータス変更" }));

    expect(onDelete).toHaveBeenCalledWith(hanako);
    expect(onChangeStatus).toHaveBeenCalledWith(hanako);
  });
});

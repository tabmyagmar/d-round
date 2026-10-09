// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { BranchRowActions } from "@/features/branches/components/list/branch-row-actions";
import type { BranchRow } from "@/features/branches/types";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../../support/grants";
import { branchRow } from "../../fixtures";

afterEach(cleanup);

/** Renders the menu for `branch` under `grants` and opens it; returns the two spies. */
const openMenu = async (branch: BranchRow, grants: readonly PermissionGrant[]) => {
  const onChangeStatus = vi.fn();
  const onDelete = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <BranchRowActions branch={branch} onChangeStatus={onChangeStatus} onDelete={onDelete} />
    </AbilityProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "新宿店の操作" }));
  await screen.findByRole("menu");
  return { onChangeStatus, onDelete };
};

const itemNames = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("BranchRowActions", () => {
  it("offers detail, edit, status change and delete to a caller holding every grant", async () => {
    const branch = branchRow();
    await openMenu(branch, EVERY_GRANT);

    expect(itemNames()).toEqual([
      "就業先情報詳細",
      "就業先情報編集",
      "ステータス変更",
      "就業先削除",
    ]);
    expect(screen.getByRole("menuitem", { name: "就業先情報編集" }).getAttribute("href")).toBe(
      href(routes.branch.update, { id: branch.id }),
    );
  });

  it("offers only the detail page to an AM, who may only read branches", async () => {
    await openMenu(branchRow(), AM_GRANTS);

    expect(itemNames()).toEqual(["就業先情報詳細"]);
  });

  it("keeps 就業先削除 disabled until the branch is 停止, then hands the row to the caller", async () => {
    await openMenu(branchRow({ status: "INACTIVE" }), EVERY_GRANT);
    expect(screen.getByRole("menuitem", { name: "就業先削除" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    cleanup();

    const branch = branchRow({ status: "SUSPENDED" });
    const { onDelete } = await openMenu(branch, EVERY_GRANT);
    fireEvent.click(screen.getByRole("menuitem", { name: "就業先削除" }));

    expect(onDelete).toHaveBeenCalledWith(branch);
  });
});

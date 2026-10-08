// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";
import type { StaffStatus } from "@repo/validation";

import { href, routes } from "@/config/routes";
import { StaffDetailToolbar } from "@/features/staff/components/detail/staff-detail-toolbar";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../../support/grants";

afterEach(cleanup);

const STAFF_ID = "019a0000-0000-7000-8000-000000000001";

const renderToolbar = (grants: readonly PermissionGrant[], status: StaffStatus = "ACTIVE") => {
  const onChangeStatus = vi.fn();
  const onDelete = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <StaffDetailToolbar
        staff={{ id: STAFF_ID, status }}
        onChangeStatus={onChangeStatus}
        onDelete={onDelete}
      />
    </AbilityProvider>,
  );
  return { onChangeStatus, onDelete };
};

describe("StaffDetailToolbar", () => {
  it("offers ステータス変更 and 編集 to a caller holding every grant, 削除 not for a staff in use", () => {
    renderToolbar(EVERY_GRANT);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "ステータス変更",
      "編集",
    ]);
    expect(screen.getByRole("button", { name: "編集" }).getAttribute("href")).toBe(
      href(routes.staff.update, { id: STAFF_ID }),
    );
  });

  it("offers 削除 for a 停止 staff and hands both actions to the caller", () => {
    const { onChangeStatus, onDelete } = renderToolbar(EVERY_GRANT, "SUSPENDED");

    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "ステータス変更" }));

    expect(onDelete).toHaveBeenCalled();
    expect(onChangeStatus).toHaveBeenCalled();
  });

  it("renders nothing for an AM, who may only read staff", () => {
    renderToolbar(AM_GRANTS, "SUSPENDED");

    expect(screen.queryByRole("button")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UserDetailToolbar } from "@/features/users/components/user-detail-toolbar";

import { EVERY_GRANT, userWith } from "../../../support/grants";

afterEach(cleanup);

const USER = { id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f", name: "山田 太郎", deletedAt: null };

const renderToolbar = (grants: readonly PermissionGrant[]) => {
  const onSendPasswordMail = vi.fn();
  const onToggleStatus = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <UserDetailToolbar
        user={USER}
        onSendPasswordMail={onSendPasswordMail}
        onToggleStatus={onToggleStatus}
      />
    </AbilityProvider>,
  );
  return { onSendPasswordMail, onToggleStatus };
};

describe("UserDetailToolbar", () => {
  it("offers edit, the password mail and 利用停止 to a caller who may do all three", () => {
    const { onSendPasswordMail, onToggleStatus } = renderToolbar(EVERY_GRANT);

    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "編集" }).getAttribute("href")).toBe(
      href(routes.user.update, { id: USER.id }),
    );
    fireEvent.click(screen.getByRole("button", { name: "パスワード設定メール" }));
    fireEvent.click(screen.getByRole("button", { name: "利用停止" }));

    expect(onSendPasswordMail).toHaveBeenCalledTimes(1);
    expect(onToggleStatus).toHaveBeenCalledTimes(1);
  });

  it("offers nothing to a caller who may only read users", () => {
    renderToolbar([{ action: "read", subject: "User" }]);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers 利用停止 without edit to a caller holding only `status User`", () => {
    renderToolbar([
      { action: "read", subject: "User" },
      { action: "status", subject: "User" },
    ]);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["利用停止"]);
  });
});

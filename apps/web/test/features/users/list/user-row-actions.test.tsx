// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { UserRowActions } from "@/features/users/list/user-row-actions";
import type { UserRow } from "@/features/users/list/users-table";

import { EVERY_GRANT, userWith } from "../../../support/grants";

import { userRow } from "./fixtures";

afterEach(cleanup);

const READ_USERS: readonly PermissionGrant[] = [{ action: "read", subject: "User" }];

/** Renders the menu for `user` under `grants` and opens it; returns the toggle spy. */
const openMenu = async (user: UserRow, grants: readonly PermissionGrant[]) => {
  const onToggleStatus = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <UserRowActions user={user} onToggleStatus={onToggleStatus} />
    </AbilityProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: `${user.name}の操作` }));
  await screen.findByRole("menu");
  return onToggleStatus;
};

const itemNames = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("UserRowActions", () => {
  it("offers detail, edit and 利用停止 to a caller who may do all three", async () => {
    const amy = userRow({ name: "Amy" });
    await openMenu(amy, EVERY_GRANT);

    expect(itemNames()).toEqual(["担当者情報詳細", "担当者情報編集", "利用停止"]);
    expect(screen.getByRole("menuitem", { name: "担当者情報編集" }).getAttribute("href")).toBe(
      href(routes.user.update, { id: amy.id }),
    );
  });

  it("offers only the detail page to a caller who may only read users", async () => {
    await openMenu(userRow({ name: "Amy" }), READ_USERS);

    expect(itemNames()).toEqual(["担当者情報詳細"]);
  });

  it("offers only 利用再開 for a deactivated user, whose pages cannot be opened", async () => {
    await openMenu(userRow({ name: "Bob", deletedAt: new Date() }), EVERY_GRANT);

    expect(itemNames()).toEqual(["利用再開"]);
  });

  it("hands the user to the caller when 利用停止 is chosen", async () => {
    const amy = userRow({ name: "Amy" });
    const onToggleStatus = await openMenu(amy, EVERY_GRANT);

    fireEvent.click(screen.getByRole("menuitem", { name: "利用停止" }));

    expect(onToggleStatus).toHaveBeenCalledWith(amy);
  });

  it("renders no menu when the caller may do nothing with the row", () => {
    render(
      <AbilityProvider user={userWith(READ_USERS)}>
        <UserRowActions
          user={userRow({ name: "Bob", deletedAt: new Date() })}
          onToggleStatus={vi.fn()}
        />
      </AbilityProvider>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});

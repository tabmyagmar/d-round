// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { href, routes } from "@/config/routes";
import { ClientRowActions } from "@/features/clients/components/list/client-row-actions";
import type { ClientRow } from "@/features/clients/types";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../../support/grants";
import { clientRow } from "../../fixtures";

afterEach(cleanup);

/** Renders the menu for `client` under `grants` and opens it; returns the two spies. */
const openMenu = async (client: ClientRow, grants: readonly PermissionGrant[]) => {
  const onChangeStatus = vi.fn();
  const onDelete = vi.fn();
  render(
    <AbilityProvider user={userWith(grants)}>
      <ClientRowActions client={client} onChangeStatus={onChangeStatus} onDelete={onDelete} />
    </AbilityProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "株式会社テストの操作" }));
  await screen.findByRole("menu");
  return { onChangeStatus, onDelete };
};

const itemNames = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("ClientRowActions", () => {
  it("offers detail, edit, status change and delete to a caller holding every grant", async () => {
    const client = clientRow();
    await openMenu(client, EVERY_GRANT);

    expect(itemNames()).toEqual([
      "クライアント情報詳細",
      "クライアント情報編集",
      "ステータス変更",
      "クライアント削除",
    ]);
    expect(
      screen.getByRole("menuitem", { name: "クライアント情報編集" }).getAttribute("href"),
    ).toBe(href(routes.client.update, { id: client.id }));
  });

  it("offers only the detail page to an AM, who may only read clients", async () => {
    await openMenu(clientRow(), AM_GRANTS);

    expect(itemNames()).toEqual(["クライアント情報詳細"]);
  });

  it("keeps クライアント削除 disabled until the client is 停止", async () => {
    await openMenu(clientRow({ status: "INACTIVE" }), EVERY_GRANT);

    expect(
      screen.getByRole("menuitem", { name: "クライアント削除" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("hands a 停止 client to the caller for ステータス変更 and クライアント削除", async () => {
    const client = clientRow({ status: "SUSPENDED" });
    const { onChangeStatus, onDelete } = await openMenu(client, EVERY_GRANT);

    fireEvent.click(screen.getByRole("menuitem", { name: "クライアント削除" }));
    fireEvent.click(screen.getByRole("button", { name: "株式会社テストの操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "ステータス変更" }));

    expect(onDelete).toHaveBeenCalledWith(client);
    expect(onChangeStatus).toHaveBeenCalledWith(client);
  });
});

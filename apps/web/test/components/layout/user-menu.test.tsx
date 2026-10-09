// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "@/components/layout/user-menu";
import type { CurrentUser } from "@/lib/auth/server";

afterEach(cleanup);

const USER: CurrentUser = {
  id: "user-1",
  name: "鈴木 花子",
  email: "admin@test.com",
  role: "admin",
  permissions: [],
};

/** Renders the menu, opens it and chooses ログアウト; returns the sign-out spy. */
const chooseLogout = async () => {
  const onSignOut = vi.fn();
  render(
    <StrictMode>
      <UserMenu user={USER} onSignOut={onSignOut} />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: "鈴木 花子" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "ログアウト" }));
  return onSignOut;
};

describe("UserMenu logout", () => {
  it("asks ログアウトしますか？ before signing out, as the legacy header", async () => {
    const onSignOut = await chooseLogout();

    const dialog = await screen.findByRole("dialog", { name: "ログアウト確認" });
    expect(dialog.textContent).toContain("ログアウトしますか？");
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("stays signed in on いいえ", async () => {
    const onSignOut = await chooseLogout();

    fireEvent.click(await screen.findByRole("button", { name: "いいえ" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("signs out on はい", async () => {
    const onSignOut = await chooseLogout();

    fireEvent.click(await screen.findByRole("button", { name: "はい" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

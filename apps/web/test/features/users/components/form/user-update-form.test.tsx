// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { href, routes } from "@/config/routes";
import { UserUpdateForm } from "@/features/users/components/form/user-update-form";
import type { UserDetail } from "@/features/users/types";

import { userRow } from "../../fixtures";

afterEach(cleanup);

const USER: UserDetail = {
  ...userRow({ name: "山田 太郎", email: "taro@example.com", role: "manager" }),
  permissionKeys: ["1202"],
};

/** Rendered in StrictMode, as `next dev` does: effects mount, unmount and mount again. */
const renderForm = (user: UserDetail = USER) => {
  const onSubmit = vi.fn();
  render(
    <StrictMode>
      <UserUpdateForm
        user={user}
        roleField={{ options: ["admin", "manager", "am"], disabled: false }}
        canEditPermissions
        pending={false}
        onSubmit={onSubmit}
      />
    </StrictMode>,
  );
  return onSubmit;
};

describe("UserUpdateForm", () => {
  it("keeps キャンセル and 保存 in the bar at the bottom of the page, outside the card", () => {
    renderForm();

    const save = screen.getByRole("button", { name: "保存" });
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    expect(save.closest("[data-slot=sticky-bar]")).not.toBeNull();
    expect(save.closest("[data-slot=card]")).toBeNull();
    expect(cancel.getAttribute("href")).toBe(href(routes.user.detail, { id: USER.id }));
  });

  it("shows the email without letting it be edited", () => {
    renderForm();

    expect(screen.getByText("taro@example.com")).toBeDefined();
    expect(screen.queryByRole("textbox", { name: /メールアドレス/ })).toBeNull();
  });

  it.each(["am", "admin"] as const)(
    "keeps 保存 disabled for an untouched %s, who has no permission field",
    (role) => {
      renderForm({ ...userRow({ role }), permissionKeys: [] });

      expect(screen.queryByRole("button", { name: "権限（詳細設定）" })).toBeNull();
      expect(screen.getByRole("button", { name: "保存" })).toHaveProperty("disabled", true);
    },
  );

  it("saves only once something changed, and sends only the change", async () => {
    const onSubmit = renderForm();
    const save = screen.getByRole("button", { name: "保存" });
    expect(save).toHaveProperty("disabled", true);

    fireEvent.input(screen.getByLabelText(/^名/), { target: { value: "花子" } });
    await waitFor(() => {
      expect(save).toHaveProperty("disabled", false);
    });
    fireEvent.click(save);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ userId: USER.id, firstName: "花子" });
    });
  });
});

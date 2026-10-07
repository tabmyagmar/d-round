// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { href, routes } from "@/config/routes";
import { UserCreateForm } from "@/features/users/components/form/user-create-form";

afterEach(cleanup);

const renderForm = () => {
  const onSubmit = vi.fn();
  render(
    <UserCreateForm
      roleField={{ options: ["admin", "manager", "staff"], disabled: false }}
      canEditPermissions
      pending={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

const fill = (label: RegExp, value: string) => {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
};

const fillName = () => {
  fill(/^姓/, "山田");
  fill(/^名/, "太郎");
  fill(/^セイ/, "ヤマダ");
  fill(/^メイ/, "タロウ");
};

describe("UserCreateForm", () => {
  it("keeps キャンセル and 招待メールを送信 in the bar at the bottom of the page, outside the card", () => {
    renderForm();

    const send = screen.getByRole("button", { name: "招待メールを送信" });
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    expect(send.closest("[data-slot=sticky-bar]")).not.toBeNull();
    expect(send.closest("[data-slot=card]")).toBeNull();
    expect(cancel.closest("[data-slot=sticky-bar]")).not.toBeNull();
    expect(cancel.getAttribute("href")).toBe(href(routes.user.list));
  });

  it("invites with the name, the email and AM as the default account type", async () => {
    const onSubmit = renderForm();

    fillName();
    fill(/^メールアドレス$|^メールアドレス\*/, "taro@example.com");
    fill(/メールアドレス（確認）/, "taro@example.com");
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "taro@example.com",
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        role: "staff",
      });
    });
  });

  it("refuses an email confirmation that differs", async () => {
    const onSubmit = renderForm();

    fillName();
    fill(/^メールアドレス$|^メールアドレス\*/, "taro@example.com");
    fill(/メールアドレス（確認）/, "jiro@example.com");
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("メールアドレスが一致していません")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for the readings in full-width katakana", async () => {
    const onSubmit = renderForm();

    fillName();
    fill(/^セイ/, "やまだ");
    fill(/^メールアドレス$|^メールアドレス\*/, "taro@example.com");
    fill(/メールアドレス（確認）/, "taro@example.com");
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("全角カタカナで入力してください")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's error", () => {
    render(
      <UserCreateForm
        roleField={{ options: ["staff"], disabled: false }}
        canEditPermissions={false}
        pending={false}
        errorMessage="A user with this email already exists"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("A user with this email already exists")).toBeDefined();
  });
});

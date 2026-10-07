// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordChangeForm } from "@/features/users/profile/password-change-form";

afterEach(cleanup);

/** Fills the three fields and submits; the zod schema answers before any request is made. */
const submitWith = (values: { current: string; next: string; confirm: string }) => {
  fireEvent.input(screen.getByLabelText("現在のパスワード"), {
    target: { value: values.current },
  });
  fireEvent.input(screen.getByLabelText("新しいパスワード"), { target: { value: values.next } });
  fireEvent.input(screen.getByLabelText("新しいパスワード（確認）"), {
    target: { value: values.confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスワードを変更" }));
};

describe("PasswordChangeForm", () => {
  it("asks for the current password, the new one and its confirmation", () => {
    render(<PasswordChangeForm />);

    expect(screen.getByLabelText("現在のパスワード")).toBeDefined();
    expect(screen.getByLabelText("新しいパスワード")).toBeDefined();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeDefined();
  });

  it("reports a confirmation that does not match", async () => {
    render(<PasswordChangeForm />);

    submitWith({ current: "Old12345", next: "New12345", confirm: "New54321" });

    expect(await screen.findByText("パスワードが一致していません")).toBeDefined();
  });

  it("applies the password policy to the new password", async () => {
    render(<PasswordChangeForm />);

    submitWith({ current: "Old12345", next: "abcdefgh", confirm: "abcdefgh" });

    expect(await screen.findByText("数字を1文字以上含めてください")).toBeDefined();
  });

  it("refuses the current password as the new one", async () => {
    render(<PasswordChangeForm />);

    submitWith({ current: "Same1234", next: "Same1234", confirm: "Same1234" });

    expect(
      await screen.findByText("現在のパスワードと異なるパスワードを入力してください"),
    ).toBeDefined();
  });
});

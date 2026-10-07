// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { href, routes } from "@/config/routes";
import { InvalidPasswordLink } from "@/features/auth/new-password-form";

afterEach(cleanup);

describe("InvalidPasswordLink", () => {
  it("sends the user to forgot-password for a new link, in the legacy wording", () => {
    render(<InvalidPasswordLink />);

    expect(screen.getByText("パスワード変更用のURLはすでに使用されています。")).toBeDefined();
    // A Base UI Button rendering a Link keeps role="button".
    expect(
      screen.getByRole("button", { name: "パスワードを忘れた方はこちら" }).getAttribute("href"),
    ).toBe(href(routes.auth.forgotPassword));
    expect(screen.getByRole("link", { name: "ログイン画面へ戻る" }).getAttribute("href")).toBe(
      href(routes.auth.login),
    );
  });
});

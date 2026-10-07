// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthCard } from "@/features/auth/auth-card";
import { brand } from "@/lib/brand";

afterEach(cleanup);

describe("AuthCard", () => {
  it("shows the brand logo above the title and the description", () => {
    render(
      <AuthCard title="ログイン" description="必要な情報を入力してログインしてください。">
        <button type="submit">ログイン</button>
      </AuthCard>,
    );

    expect(screen.getByRole("img", { name: brand.name })).toBeDefined();
    expect(screen.getByText("ログイン", { selector: "[data-slot=card-title]" })).toBeDefined();
    expect(screen.getByText("必要な情報を入力してログインしてください。")).toBeDefined();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeDefined();
  });

  it("leaves the description out when there is none", () => {
    const { container } = render(<AuthCard title="パスワード設定">本文</AuthCard>);

    expect(container.querySelector("[data-slot=card-description]")).toBeNull();
    expect(screen.getByText("本文")).toBeDefined();
  });
});

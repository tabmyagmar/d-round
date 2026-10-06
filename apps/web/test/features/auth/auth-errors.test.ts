import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/features/auth/auth-errors";

describe("authErrorMessage", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "メールアドレスまたはパスワードが正しくありません"],
    ["BANNED_USER", "現在のアカウントではログインできません"],
    ["INVALID_PASSWORD", "現在のパスワードが正しくありません"],
    ["INVALID_TOKEN", "URLの有効期限が切れているか、すでに使用されています"],
  ])("translates %s", (code, message) => {
    expect(authErrorMessage({ code, status: 400 })).toBe(message);
  });

  it("points an unverified user at the forgot-password flow", () => {
    expect(authErrorMessage({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toContain(
      "パスワードをお忘れの方",
    );
  });

  it("keeps the server's own Japanese message for a password-policy refusal", () => {
    expect(
      authErrorMessage({
        code: "PASSWORD_POLICY",
        status: 400,
        message: "数字を1文字以上含めてください",
      }),
    ).toBe("数字を1文字以上含めてください");
  });

  it("explains a rate-limited request", () => {
    expect(authErrorMessage({ status: 429 })).toBe(
      "試行回数が多すぎます。しばらく時間をおいて再度お試しください",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(authErrorMessage({ code: "SOMETHING_NEW", status: 500 })).toBe(
      "エラーが発生しました。時間をおいて再度お試しください",
    );
    expect(authErrorMessage({ status: 400 })).toBe(
      "エラーが発生しました。時間をおいて再度お試しください",
    );
  });
});

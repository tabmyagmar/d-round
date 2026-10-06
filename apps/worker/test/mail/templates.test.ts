import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATES } from "@repo/queue";

import { TemplateError, renderEmail } from "../../src/mail/templates";

const brand = { appName: "D-Round" };
const url = "https://app.example.com/api/auth/reset-password/abc?callbackURL=x";

describe.each([
  [
    EMAIL_TEMPLATES.passwordReset,
    "「D-Round」アカウント パスワード再設定のご案内",
    "パスワード再設定画面へ",
  ],
  [EMAIL_TEMPLATES.accountInvitation, "「D-Round」ご利用登録のお知らせ", "パスワード設定画面へ"],
  [
    EMAIL_TEMPLATES.verification,
    "「D-Round」メールアドレス確認のお願い",
    "メールアドレスを確認する",
  ],
])("renderEmail(%s)", (template, subject, buttonLabel) => {
  const mail = renderEmail(template, { name: "山田 太郎", url }, brand);

  it("has the Japanese subject with the brand", () => {
    expect(mail.subject).toBe(subject);
  });

  it("addresses the user and links the URL from a button in the html", () => {
    expect(mail.html).toContain("山田 太郎様");
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.html).toContain(buttonLabel);
  });

  it("carries the URL and the expiry in the plain-text part", () => {
    expect(mail.text).toContain("山田 太郎様");
    expect(mail.text).toContain(url);
    expect(mail.text).toContain("1時間");
  });
});

describe("renderEmail escaping", () => {
  it("escapes the name and the URL in the html", () => {
    const mail = renderEmail(
      EMAIL_TEMPLATES.passwordReset,
      { name: "<b>Taro</b>", url: 'https://app.example.com/?a="x"' },
      brand,
    );
    expect(mail.html).toContain("&lt;b&gt;Taro&lt;/b&gt;様");
    expect(mail.html).not.toContain("<b>Taro</b>");
    expect(mail.html).toContain('href="https://app.example.com/?a=&quot;x&quot;"');
  });

  it("escapes the brand", () => {
    const mail = renderEmail(
      EMAIL_TEMPLATES.accountInvitation,
      { name: "Taro", url },
      {
        appName: "A&B",
      },
    );
    expect(mail.html).toContain("A&amp;B");
  });
});

describe("renderEmail failures", () => {
  it("treats unknown templates and bad payloads as permanent errors", () => {
    expect(() => renderEmail("newsletter", {}, brand)).toThrow(TemplateError);
    expect(() => renderEmail("toString", { name: "x", url }, brand)).toThrow(TemplateError);
    expect(() => renderEmail(EMAIL_TEMPLATES.passwordReset, { name: "x" }, brand)).toThrow(
      TemplateError,
    );
    expect(() =>
      renderEmail(EMAIL_TEMPLATES.accountInvitation, { name: "x", url: "not a url" }, brand),
    ).toThrow(TemplateError);
    expect(() => renderEmail(EMAIL_TEMPLATES.verification, { name: "", url }, brand)).toThrow(
      TemplateError,
    );
  });
});

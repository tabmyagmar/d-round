import { describe, expect, it } from "vitest";

import { TemplateError, renderEmail } from "../../src/mail/templates";

describe("renderEmail", () => {
  it("renders the verification email with the link in text and html", () => {
    const mail = renderEmail(
      "verification-email",
      { name: "Bat <script>", url: "https://app.example.com/verify?token=abc" },
      { appName: "Acme Portal" },
    );

    expect(mail.subject).toBe("Confirm your Acme Portal account");
    expect(mail.text).toContain("your Acme Portal account");
    expect(mail.text).toContain("https://app.example.com/verify?token=abc");
    expect(mail.html).toContain('href="https://app.example.com/verify?token=abc"');
    expect(mail.html).toContain("Bat &lt;script&gt;");
  });

  it("treats unknown templates and bad payloads as permanent errors", () => {
    const brand = { appName: "Acme" };
    expect(() => renderEmail("newsletter", {}, brand)).toThrow(TemplateError);
    expect(() => renderEmail("verification-email", { name: "x" }, brand)).toThrow(TemplateError);
    expect(() => renderEmail("verification-email", { name: "x", url: "not a url" }, brand)).toThrow(
      TemplateError,
    );
  });
});

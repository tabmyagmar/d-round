import { describe, expect, it } from "vitest";

import { TemplateError, renderEmail } from "./templates";

describe("renderEmail", () => {
  it("renders the verification email with the link in text and html", () => {
    const mail = renderEmail("verification-email", {
      name: "Bat <script>",
      url: "https://app.example.com/verify?token=abc",
    });

    expect(mail.subject).toContain("Confirm");
    expect(mail.text).toContain("https://app.example.com/verify?token=abc");
    expect(mail.html).toContain('href="https://app.example.com/verify?token=abc"');
    expect(mail.html).toContain("Bat &lt;script&gt;");
  });

  it("treats unknown templates and bad payloads as permanent errors", () => {
    expect(() => renderEmail("newsletter", {})).toThrow(TemplateError);
    expect(() => renderEmail("verification-email", { name: "x" })).toThrow(TemplateError);
    expect(() => renderEmail("verification-email", { name: "x", url: "not a url" })).toThrow(
      TemplateError,
    );
  });
});

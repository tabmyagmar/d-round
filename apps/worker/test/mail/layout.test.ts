import { describe, expect, it } from "vitest";

import { buttonRow, cautionRow, renderLayout, textRows } from "../../src/mail/layout";

describe("mail layout", () => {
  it("wraps the rows in the shared shell with the eyebrow, title, footer note and brand", () => {
    const html = renderLayout({
      appName: "D-Round",
      eyebrow: "パスワード再設定",
      title: "パスワード再設定のご案内",
      footerNote: "自動送信しております。",
      rows: textRows(["本文"]),
    });
    expect(html).toContain("パスワード再設定");
    expect(html).toContain("パスワード再設定のご案内");
    expect(html).toContain("自動送信しております。");
    expect(html).toContain("本文");
    expect(html).toContain("D-Round");
    // Table-based with inline styles only: mail clients drop <style> blocks.
    expect(html).not.toContain("<style");
    expect(html).toContain('role="presentation"');
  });

  it("escapes every value it is given", () => {
    const html = renderLayout({
      appName: "<A>",
      eyebrow: "<e>",
      title: "<t>",
      footerNote: "<f>",
      rows: [
        textRows(["<p1>"]),
        buttonRow('https://x.example/?q="1"', "<label>"),
        cautionRow(["<c1>"]),
      ].join(""),
    });
    for (const raw of ["<A>", "<e>", "<t>", "<f>", "<p1>", "<label>", "<c1>"]) {
      expect(html).not.toContain(raw);
    }
    expect(html).toContain("&lt;p1&gt;");
    expect(html).toContain('href="https://x.example/?q=&quot;1&quot;"');
  });
});

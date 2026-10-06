/**
 * The shared shell of every mail, ported from the legacy d-round-api `_layout.html` and its
 * partials: a 600px card with an eyebrow, a title, the template's rows and a footer note.
 * Table-based with inline styles only — Gmail and Outlook drop <style> blocks and never supported
 * flexbox or grid. Colours are the web theme's brand blue (#062c9b) and its tints, so the mail
 * reads as the same product. Every value passed in is escaped here; callers pass plain text.
 */

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif";
const BRAND = "#062c9b";
const BRAND_TINT = "#e0ebfd";
const TEXT = "#191919";
const MUTED = "#6b7280";

/** Paragraphs of body text, one row. */
export const textRows = (paragraphs: readonly string[]): string =>
  `<tr><td style="padding:0 32px 16px 32px;font-size:14px;line-height:1.8;color:${TEXT};">${paragraphs
    .map((paragraph) => `<p style="margin:0 0 12px 0;">${escapeHtml(paragraph)}</p>`)
    .join("")}</td></tr>`;

/** The call to action: a full-width brand button. */
export const buttonRow = (href: string, label: string): string =>
  [
    `<tr><td align="center" style="padding:8px 32px 24px 32px;">`,
    `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;background-color:${BRAND};`,
    `color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">`,
    escapeHtml(label),
    `</a></td></tr>`,
  ].join("");

/** Notes in a tinted box (expiry, what to do when the link has expired). */
export const cautionRow = (lines: readonly string[]): string =>
  [
    `<tr><td style="padding:0 32px 24px 32px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `,
    `style="background-color:${BRAND_TINT};border-radius:8px;">`,
    `<tr><td style="padding:16px;font-size:12px;line-height:1.8;color:${TEXT};">`,
    lines.map(escapeHtml).join("<br />"),
    `</td></tr></table></td></tr>`,
  ].join("");

export type LayoutInput = {
  appName: string;
  /** Small label above the title, e.g. パスワード再設定. */
  eyebrow: string;
  title: string;
  /** Why the recipient got this mail. */
  footerNote: string;
  /** `<tr>` rows built with the helpers above (already escaped). */
  rows: string;
};

export const renderLayout = ({ appName, eyebrow, title, footerNote, rows }: LayoutInput): string =>
  [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `,
    `style="background-color:#eef1f6;padding:24px 12px;font-family:${FONT};">`,
    `<tr><td align="center">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" `,
    `style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;">`,
    `<tr><td style="padding:20px 32px;background-color:${BRAND};color:#ffffff;font-size:18px;font-weight:bold;">`,
    escapeHtml(appName),
    `</td></tr>`,
    `<tr><td style="padding:28px 32px 4px 32px;font-size:12px;font-weight:bold;color:${BRAND};">`,
    escapeHtml(eyebrow),
    `</td></tr>`,
    `<tr><td style="padding:0 32px 20px 32px;font-size:20px;font-weight:bold;color:${TEXT};">`,
    escapeHtml(title),
    `</td></tr>`,
    rows,
    `<tr><td style="padding:16px 32px 24px 32px;border-top:1px solid ${BRAND_TINT};font-size:11px;line-height:1.7;color:${MUTED};">`,
    escapeHtml(footerNote),
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
  ].join("");

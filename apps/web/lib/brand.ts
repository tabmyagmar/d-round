/**
 * The one place the web app knows its own name. `scripts/init-template.mjs` fills the
 * placeholders; the worker takes the brand for emails from the MAIL_FROM display name.
 */
export const brand = {
  name: "D-Round",
  description: "D-Round",
  /** `<html lang>` — BCP 47 tag such as "en" or "ja". */
  htmlLang: "ja",
  /**
   * The logo in the sidebar and on the auth card (`name` is its alt text). Another product
   * replaces `public/logo.png` and these intrinsic pixel sizes, which `next/image` uses for the
   * aspect ratio.
   */
  logo: { src: "/logo.png", width: 300, height: 100 },
  /** Full-screen background of the login, forgot-password and new-password pages. */
  authBackground: "/auth-background.webp",
} as const;

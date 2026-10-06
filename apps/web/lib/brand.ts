/**
 * The one place the web app knows its own name. `scripts/init-template.mjs` fills the
 * placeholders; the worker takes the brand for emails from the MAIL_FROM display name.
 */
export const brand = {
  name: "{{PROJECT_NAME}}",
  description: "{{PROJECT_DESCRIPTION}}",
  /** `<html lang>` — BCP 47 tag such as "en" or "ja". */
  htmlLang: "{{HTML_LANG}}",
  /**
   * The sidebar logo (`name` is its alt text). Another product replaces `public/logo.png` and
   * these intrinsic pixel sizes, which `next/image` uses for the aspect ratio.
   */
  logo: { src: "/logo.png", width: 300, height: 100 },
} as const;

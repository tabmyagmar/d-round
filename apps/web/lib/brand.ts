/**
 * The one place the web app knows its own name. `scripts/init-template.mjs` fills the
 * placeholders; the worker takes the brand for emails from the MAIL_FROM display name.
 */
export const brand = {
  name: "{{PROJECT_NAME}}",
  description: "{{PROJECT_DESCRIPTION}}",
  /** `<html lang>` — BCP 47 tag such as "en" or "ja". */
  htmlLang: "{{HTML_LANG}}",
} as const;

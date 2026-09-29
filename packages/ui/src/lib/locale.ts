/**
 * Default BCP 47 locale for formatted dates and numbers (`formatDate`, `ReadOnlyField`). Explicit
 * so server and client render the same text. `scripts/init-template.mjs --lang` rewrites it;
 * pass `locale` per field to override.
 */
export const DEFAULT_LOCALE = "en";

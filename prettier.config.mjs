/**
 * Formatting is a tool concern, not a review concern: every rule below is enforced by
 * lint-staged on commit and by `yarn verify` in CI. Do not argue with the formatter.
 *
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 has no config file; the plugin needs the CSS entry to sort classes.
  tailwindStylesheet: "./packages/ui/src/styles/globals.css",
};

export default config;

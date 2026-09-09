/**
 * Runs on staged files only (husky pre-commit). ESLint 10 resolves the nearest
 * eslint.config.mjs for each file, so each workspace's own preset applies.
 *
 * @type {import("lint-staged").Configuration}
 */
export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings 0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{json,md,mdx,yml,yaml,css}": ["prettier --write"],
};

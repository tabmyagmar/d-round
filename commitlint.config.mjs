/**
 * Conventional Commits, enforced by the husky commit-msg hook and CI.
 * AI-assisted commits carry the attribution trailer described in
 * docs/conventions.md#ai-attribution.
 *
 * @type {import("@commitlint/types").UserConfig}
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [2, "always", 100],
    // Trailers such as Co-Authored-By can legitimately exceed 100 chars.
    "footer-max-line-length": [2, "always", 200],
  },
};

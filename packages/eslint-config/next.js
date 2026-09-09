import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

import { reactConfig } from "./react.js";

/** App Router files that Next.js requires to be default exports. */
const NEXT_SPECIAL_FILES = [
  "page",
  "layout",
  "template",
  "loading",
  "error",
  "global-error",
  "not-found",
  "default",
  "route",
  "sitemap",
  "robots",
  "manifest",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
];

/**
 * Next.js apps (apps/web): react preset + Next core-web-vitals rules + framework exemptions.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export const nextConfig = (options) =>
  defineConfig(
    reactConfig(options),
    {
      name: "repo/next",
      files: ["**/*.{ts,tsx}"],
      extends: [nextPlugin.configs["core-web-vitals"]],
    },
    {
      name: "repo/next/framework-files",
      files: [
        `**/app/**/{${NEXT_SPECIAL_FILES.join(",")}}.{ts,tsx}`,
        "**/proxy.ts",
        "**/middleware.ts",
        "**/instrumentation.ts",
        "**/instrumentation-client.ts",
        "**/mdx-components.tsx",
        "**/next.config.*",
      ],
      rules: {
        // The framework, not us, decides that these modules export a default.
        "import-x/no-default-export": "off",
      },
    },
    eslintConfigPrettier,
  );

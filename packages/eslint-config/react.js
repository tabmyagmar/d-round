import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { baseConfig } from "./base.js";

/**
 * React libraries (packages/ui). @eslint-react replaces the unmaintained eslint-plugin-react
 * (no ESLint 10 support) and is type-aware; eslint-plugin-react-hooks covers the rules of hooks.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export const reactConfig = (options) =>
  defineConfig(
    baseConfig(options),
    {
      name: "repo/react",
      files: ["**/*.{ts,tsx}"],
      extends: [
        eslintReact.configs["recommended-type-checked"],
        reactHooks.configs.flat.recommended,
      ],
      languageOptions: { globals: { ...globals.browser } },
    },
    {
      name: "repo/react/components",
      files: ["**/*.tsx"],
      rules: {
        // Component files may be PascalCase (Button.tsx) or kebab-case (button.tsx, shadcn).
        "unicorn/filename-case": [
          "error",
          { cases: { kebabCase: true, pascalCase: true }, ignore: [/^\[.*\]/] },
        ],
      },
    },
    eslintConfigPrettier,
  );

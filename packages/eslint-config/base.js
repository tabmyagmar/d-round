import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import boundaries from "eslint-plugin-boundaries";
import { flatConfigs as importX } from "eslint-plugin-import-x";
import turbo from "eslint-plugin-turbo";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

import { boundariesRules, boundariesSettings } from "./boundaries.js";

/**
 * Shared base preset (ESLint 10 flat config). Every rule group starts with a WHY comment;
 * the long-form rationale lives in docs/conventions.md. Rules are the enforcement layer of
 * CLAUDE.md: what the linter checks does not need to be argued about in review.
 *
 * @param {{ tsconfigRootDir: string }} options  Pass `import.meta.dirname` of the workspace.
 */
export const baseConfig = ({ tsconfigRootDir }) =>
  defineConfig(
    {
      name: "repo/ignores",
      ignores: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/.turbo/**",
        "**/coverage/**",
        "**/generated/**",
        "**/next-env.d.ts",
      ],
    },

    {
      name: "repo/typescript",
      files: ["**/*.{ts,tsx,mts,cts}"],
      extends: [
        js.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked,
        importX.recommended,
        importX.typescript,
      ],
      languageOptions: {
        globals: { ...globals.es2024 },
        parserOptions: {
          // Type-aware linting against the nearest tsconfig.json of each workspace.
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: { boundaries, unicorn, turbo },
      settings: {
        "import-x/internal-regex": "^@repo/",
        "import-x/resolver-next": [
          createTypeScriptImportResolver({ alwaysTryTypes: true, project: tsconfigRootDir }),
        ],
        // eslint-plugin-boundaries resolves through the classic resolver interface.
        "import/resolver": { typescript: { alwaysTryTypes: true, project: tsconfigRootDir } },
        ...boundariesSettings,
      },
      rules: {
        // --- Functions: one shape everywhere. Arrow functions have no `this`/hoisting
        // surprises and read the same in modules, callbacks and React components.
        "func-style": ["error", "expression"],
        "prefer-arrow-callback": ["error", { allowNamedFunctions: false }],

        // --- Modules: named exports keep symbols greppable and refactor-safe. Frameworks
        // that require default exports (Next.js routes, config files) are exempted below.
        "import-x/no-default-export": "error",
        "import-x/no-duplicates": "error",
        // Type-only imports live in their own `import type` statement: with
        // verbatimModuleSyntax an `import { type X }` is kept as a side-effect import.
        "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
        "import-x/no-cycle": ["error", { maxDepth: 4 }],
        // Deterministic import blocks: node built-ins, third-party, @repo/* workspace
        // packages, then relative paths — alphabetised, one blank line between groups.
        "import-x/order": [
          "error",
          {
            groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
            pathGroups: [
              { pattern: "@repo/**", group: "internal", position: "before" },
              { pattern: "@/**", group: "internal", position: "after" },
            ],
            pathGroupsExcludedImportTypes: ["builtin"],
            "newlines-between": "always",
            alphabetize: { order: "asc", caseInsensitive: true },
          },
        ],

        // --- Types: `any` and unchecked access defeat the point of TypeScript; type-only
        // imports must be marked so verbatimModuleSyntax/bundlers can erase them.
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports", fixStyle: "separate-type-imports" },
        ],
        "@typescript-eslint/no-import-type-side-effects": "error",
        "@typescript-eslint/consistent-type-exports": [
          "error",
          { fixMixedExportsWithInlineTypeSpecifier: true },
        ],
        // `type` aliases everywhere; the only legitimate `interface` is a module augmentation
        // (declaration merging), which gets an inline eslint-disable with the reason.
        "@typescript-eslint/consistent-type-definitions": ["error", "type"],
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        // Bracket access is the honest way to read index-signature objects (parsed JSON, env).
        "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: true }],
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          { allowNumber: true, allowBoolean: true },
        ],
        // React props/handlers legitimately receive async functions.
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false, arguments: false } },
        ],

        // --- Logging: structured logs go through @repo/logger; console output is lost in
        // production. packages/logger and the worker bootstrap opt out locally.
        "no-console": "error",

        // --- Naming: kebab-case files with a role suffix (user.service.ts). React
        // components may be PascalCase.tsx (see react preset). Dynamic route segments
        // ([id].tsx) are ignored.
        "unicorn/filename-case": ["error", { case: "kebabCase", ignore: [/^\[.*\]/] }],
        // node: prefix makes built-in imports unambiguous for bundlers and readers.
        "unicorn/prefer-node-protocol": "error",

        // --- Environment: Turborepo runs tasks in strict env mode; a variable that is not
        // declared in turbo.json silently disappears at task time.
        "turbo/no-undeclared-env-vars": [
          "error",
          { allowList: ["^NEXT_PUBLIC_", "^TEST_", "NODE_ENV", "CI"] },
        ],

        // --- Layer boundaries (packages/eslint-config/boundaries.js).
        ...boundariesRules,

        // --- Misc footguns.
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-param-reassign": "error",
        "object-shorthand": "error",
        "prefer-template": "error",
      },
    },

    {
      name: "repo/tests",
      files: ["**/*.test.{ts,tsx}", "**/test/**/*.ts"],
      rules: {
        // Tests assert behaviour; a little type looseness keeps them readable.
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },

    {
      name: "repo/config-files",
      files: [
        "**/*.config.{ts,mts,cts,js,mjs,cjs}",
        "**/eslint.config.*",
        "**/prisma.config.ts",
        "**/postcss.config.*",
      ],
      rules: {
        // Tooling contracts (Vitest, Prisma, tsdown, PostCSS, ESLint) require default exports.
        "import-x/no-default-export": "off",
      },
    },

    {
      name: "repo/javascript",
      files: ["**/*.{js,mjs,cjs}"],
      extends: [js.configs.recommended, importX.recommended],
      languageOptions: { globals: { ...globals.node, ...globals.es2024 } },
      plugins: { unicorn },
      rules: {
        "func-style": ["error", "expression"],
        "prefer-arrow-callback": "error",
        "import-x/order": [
          "error",
          { "newlines-between": "always", alphabetize: { order: "asc" } },
        ],
        "unicorn/filename-case": ["error", { case: "kebabCase" }],
        "unicorn/prefer-node-protocol": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
      },
    },

    // Prettier owns formatting; disable every stylistic rule that could disagree with it.
    eslintConfigPrettier,
  );

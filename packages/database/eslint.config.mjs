import { nodeConfig } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

const SEED_PRODUCTION_SAFE_MESSAGE =
  "Only prisma/seed/index.ts may seed test users; reference seeds must stay production-safe.";

export default defineConfig(
  { ignores: ["src/generated/**"] },
  nodeConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // `yarn db:seed:reference` runs in production: only the dev entrypoint may pull in test users.
    name: "database/seed-production-safe",
    files: ["prisma/seed/**/*.ts"],
    ignores: ["prisma/seed/index.ts", "prisma/seed/users.seed.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "./users.seed",
                "**/users.seed",
                "**/users.seed.*",
                "./index",
                "./index.*",
                "**/seed/index",
                "**/seed/index.*",
                "better-auth",
                "better-auth/*",
                "@better-auth/*",
              ],
              message: SEED_PRODUCTION_SAFE_MESSAGE,
            },
          ],
        },
      ],
      // no-restricted-imports does not see dynamic import(); this covers import("...") literals.
      "no-restricted-syntax": [
        "error",
        {
          selector: String.raw`ImportExpression[source.value=/users\.seed|better-auth|seed\/index/]`,
          message: SEED_PRODUCTION_SAFE_MESSAGE,
        },
      ],
    },
  },
);

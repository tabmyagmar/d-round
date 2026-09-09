import { defineConfig } from "eslint/config";
import globals from "globals";

import { baseConfig } from "./base.js";

/**
 * Node.js workspaces (apps/api, apps/worker, packages/*).
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export const nodeConfig = (options) =>
  defineConfig(baseConfig(options), {
    name: "repo/node",
    files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
  });

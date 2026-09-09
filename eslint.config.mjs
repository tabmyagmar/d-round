import { baseConfig } from "@repo/eslint-config/base";
import { defineConfig } from "eslint/config";

/**
 * Root config covers root-level tooling files only. Workspaces have their own
 * eslint.config.mjs, which ESLint 10 finds by walking up from each linted file.
 */
export default defineConfig(
  { ignores: ["apps/**", "packages/**"] },
  baseConfig({ tsconfigRootDir: import.meta.dirname }),
);

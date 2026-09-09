import { nodeConfig } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

export default defineConfig(nodeConfig({ tsconfigRootDir: import.meta.dirname }), {
  // Bootstrap may print to the console before the logger exists (env validation failures).
  files: ["src/index.ts"],
  rules: { "no-console": "off" },
});

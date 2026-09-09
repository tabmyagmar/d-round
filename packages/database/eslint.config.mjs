import { nodeConfig } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["src/generated/**"] },
  nodeConfig({ tsconfigRootDir: import.meta.dirname }),
);

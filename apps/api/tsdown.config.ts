import { defineConfig } from "tsdown";

/**
 * Bundles the app together with the workspace packages (they ship TypeScript source),
 * while everything from node_modules stays external and is resolved at runtime.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  deps: {
    neverBundle: true,
    alwaysBundle: [/^@repo\//],
  },
});

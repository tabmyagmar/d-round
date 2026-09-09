import { defineConfig } from "tsdown";

/** Same strategy as apps/api: bundle @repo/* source, keep node_modules external. */
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

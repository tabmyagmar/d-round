import { defineConfig } from "vitest/config";

/**
 * Root runner: `yarn vitest` from the repo root runs every workspace project (IDE
 * integration uses this too). CI and `yarn test` go through Turborepo per package so
 * results are cached per workspace.
 */
export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts", "apps/*/vitest.config.ts"],
  },
});

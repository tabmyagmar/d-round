import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/database",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // One Postgres testcontainer per run (see test/global-setup.ts).
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/auth",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});

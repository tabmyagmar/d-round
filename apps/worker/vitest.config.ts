import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/worker",
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Postgres + Redis testcontainers for processor/sweeper tests (see test/global-setup.ts).
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});

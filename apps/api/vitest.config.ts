import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/api",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Postgres + Redis testcontainers for the HTTP-level tests (see test/global-setup.ts).
    globalSetup: ["./test/global-setup.ts"],
    // Files share one database; global invariants (e.g. "last admin") need sequential files.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});

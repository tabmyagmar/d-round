import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/permissions",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

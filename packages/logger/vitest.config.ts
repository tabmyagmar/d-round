import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/logger",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});

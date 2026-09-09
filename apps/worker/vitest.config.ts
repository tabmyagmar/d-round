import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/worker",
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});

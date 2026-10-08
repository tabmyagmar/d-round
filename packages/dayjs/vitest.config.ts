import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/dayjs",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});

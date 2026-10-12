import { fileURLToPath } from "node:url";

import { defineProject } from "vitest/config";

/** Component tests run in jsdom with Testing Library; no providers, no network. */
export default defineProject({
  // Same alias as tsconfig.json ("@repo/ui/*" → src/*).
  resolve: { alias: { "@repo/ui": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Vite 8 transforms with oxc; the JSX runtime is explicit so it never depends on tsconfig.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    name: "@repo/ui",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    // CI runs every workspace's tasks at once on one runner, where a jsdom render is tens of times
    // slower than here: the calendar test takes 250 ms locally and took 10 s there.
    testTimeout: 30_000,
  },
});

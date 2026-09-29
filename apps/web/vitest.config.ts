import { fileURLToPath } from "node:url";

import { defineProject } from "vitest/config";

/**
 * Unit tests for the web app: pure modules run in node; component tests opt into jsdom with a
 * `// @vitest-environment jsdom` docblock. Nothing here touches Postgres or Redis — API behaviour
 * is tested in apps/api against real containers.
 */
export default defineProject({
  // Same alias as tsconfig.json ("@/*" → workspace root).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // Vite 8 transforms with oxc and reads tsconfig `jsx`; Next.js sets "preserve", so be explicit.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    name: "@repo/web",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});

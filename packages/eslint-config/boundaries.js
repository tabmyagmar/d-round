import { resolve } from "node:path";

/**
 * Architecture contract, enforced at lint time (human-readable rationale: docs/conventions.md).
 *
 *   transport (apps/api/src/trpc) → service (apps/api/src/modules)
 *     → repository (packages/database/src/repositories) → prisma
 *
 * Two mechanisms:
 *  1. Element policies — folders inside one workspace (e.g. a service must not import trpc/).
 *  2. Module policies — cross-workspace imports. `@repo/*` imports are flagged as external
 *     modules on purpose, so rules are written against the package name and do not depend on
 *     how the resolver follows workspace symlinks.
 */

export const MONOREPO_ROOT = resolve(import.meta.dirname, "../..");

const element = (type, pattern) => ({ type, pattern, partialMatch: false });

/** Most specific first: the first matching descriptor classifies the file. */
export const boundariesElements = [
  element("api-transport", "apps/api/src/trpc"),
  element("api-transport", "apps/api/src/graphql"),
  element("api-transport", "apps/api/src/rest"),
  element("api-service", "apps/api/src/modules"),
  element("api-core", "apps/api/src/core"),
  element("api-app", "apps/api/src"),
  element("repository", "packages/database/src/repositories"),
  element("database", "packages/database"),
  element("worker", "apps/worker/src"),
  element("web", "apps/web"),
  element("ui", "packages/ui"),
  element("shared", "packages/*"),
];

const TRANSPORT_LIBRARIES = ["@trpc/*", "hono", "@hono/*", "graphql", "graphql-yoga"];
const SERVER_ONLY_PACKAGES = ["@repo/database", "@repo/queue", "@repo/logger"];

const allowLocal = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { type: to } } },
});

const disallowPackages = (from, sources, extra = {}) => ({
  from: { element: { type: from } },
  disallow: { to: { module: { origin: "external", source: sources } }, ...extra },
});

/** Policies are evaluated in order; the LAST matching policy wins. */
export const boundariesPolicies = [
  // 1. Third-party and Node built-ins are allowed everywhere unless a later policy forbids them.
  { allow: { to: { module: { origin: "external" } } } },
  { allow: { to: { module: { origin: "core" } } } },

  // 2. Folder layering inside a workspace.
  allowLocal("api-transport", ["api-transport", "api-service", "api-core"]),
  allowLocal("api-service", ["api-service", "api-core"]),
  allowLocal("api-core", ["api-core"]),
  allowLocal("api-app", ["api-app", "api-transport", "api-service", "api-core"]),
  allowLocal("repository", ["repository", "database"]),
  allowLocal("database", ["database", "repository"]),
  allowLocal("worker", ["worker"]),
  allowLocal("web", ["web"]),
  allowLocal("ui", ["ui"]),
  allowLocal("shared", ["shared"]),

  // 3. Cross-workspace rules, by package name.
  // Transports talk to services, never to the data layer directly (types are fine).
  disallowPackages("api-transport", ["@repo/database"], { dependency: { kind: "value" } }),
  // Services know nothing about the transport (tRPC/Hono live in trpc/ and core/error-mapping).
  disallowPackages("api-service", TRANSPORT_LIBRARIES),
  // Repositories are pure data access: no validation, no queueing, no transport.
  disallowPackages("repository", [
    ...TRANSPORT_LIBRARIES,
    "zod",
    "@repo/validation",
    "@repo/queue",
  ]),
  disallowPackages("database", [
    ...TRANSPORT_LIBRARIES,
    "@repo/queue",
    "@repo/api",
    "@repo/worker",
  ]),
  // Shared packages never depend on applications.
  disallowPackages("shared", ["@repo/api", "@repo/worker", "@repo/web"]),
  disallowPackages("ui", ["@repo/api", "@repo/worker", "@repo/web", ...SERVER_ONLY_PACKAGES]),
  // The worker reuses repositories/packages but never the API's code.
  disallowPackages("worker", [...TRANSPORT_LIBRARIES, "@repo/api", "@repo/web"]),
  // The web app may import API *types* (AppRouter) and nothing server-side.
  disallowPackages("web", ["@repo/api"], { dependency: { kind: "value" } }),
  disallowPackages("web", SERVER_ONLY_PACKAGES),
  // Queue consumers live only in apps/worker.
  {
    from: {
      element: {
        type: [
          "api-app",
          "api-transport",
          "api-service",
          "api-core",
          "web",
          "ui",
          "shared",
          "database",
          "repository",
        ],
      },
    },
    disallow: {
      to: { module: { source: "@repo/queue" } },
      dependency: { specifiers: "createWorker" },
    },
    message: "Queue consumers (createWorker) may only be created in apps/worker",
  },
];

export const boundariesSettings = {
  "boundaries/root-path": MONOREPO_ROOT,
  "boundaries/elements": boundariesElements,
  "boundaries/ignore": ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/generated/**"],
  "boundaries/dependency-nodes": ["import", "export", "dynamic-import"],
  "boundaries/flag-as-external": {
    unresolvableAlias: true,
    inNodeModules: true,
    outsideRootPath: false,
    // Both bare (`@repo/logger`) and sub-path (`@repo/validation/env`) workspace imports.
    customSourcePatterns: ["@repo/*", "@repo/*/**"],
  },
};

export const boundariesRules = {
  "boundaries/dependencies": [
    "error",
    {
      default: "disallow",
      checkAllOrigins: true,
      policies: boundariesPolicies,
    },
  ],
};

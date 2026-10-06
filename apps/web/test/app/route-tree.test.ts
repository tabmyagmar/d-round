import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ALL_ROUTES, routes } from "@/config/routes";
import type { AppRoute } from "@/config/routes";

/**
 * The real `app/` tree against the route catalog: the web counterpart of "every non-public
 * procedure has requireAbility". A catalog entry without a page, a page without an entry, an
 * /admin page guarded by a sibling's route (a create page behind `list`), or a guard that is not
 * the page's root (content rendered around it) fails here.
 */

const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));

/** Pages that are deliberately not in the catalog: the public landing and the /admin 404 catch-all. */
const ROOT_PAGE = "/";
const ADMIN_CATCH_ALL = "/admin/[...slug]";

type PageFile = { pattern: string; file: string };

const isRouteGroup = (segment: string): boolean => segment.startsWith("(") && segment.endsWith(")");

/** `(auth)/login/page.tsx` → `/login`, `admin/client/[id]/page.tsx` → `/admin/client/[id]`. */
const patternOf = (relativeFile: string): string => {
  const segments = relativeFile
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !isRouteGroup(segment));
  return `/${segments.join("/")}`;
};

const PAGES: PageFile[] = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
  .filter((relativeFile) => relativeFile.split(sep).at(-1) === "page.tsx")
  .map((relativeFile) => ({ pattern: patternOf(relativeFile), file: join(APP_DIR, relativeFile) }))
  .filter(({ pattern }) => pattern !== ROOT_PAGE && pattern !== ADMIN_CATCH_ALL);

const ADMIN_PAGES = PAGES.filter(
  ({ pattern }) => pattern === "/admin" || pattern.startsWith("/admin/"),
);

type RouteGroup = Readonly<Record<string, AppRoute>>;

const isRoute = (entry: AppRoute | RouteGroup): entry is AppRoute => typeof entry.path === "string";

/** Every expression a page may pass to `PageGuard` (`routes.home`, `routes.client.create`, …). */
const ROUTE_EXPRESSIONS = new Map<string, AppRoute>(
  Object.entries<AppRoute | RouteGroup>(routes).flatMap(([key, entry]): [string, AppRoute][] =>
    isRoute(entry)
      ? [[`routes.${key}`, entry]]
      : Object.entries(entry).map(([name, route]) => [`routes.${key}.${name}`, route]),
  ),
);

const GUARD = /<PageGuard\s+route=\{([^}]*)\}\s*>/g;

/** The source without block and line comments (the `//` of `https://` is kept). */
const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|\s)\/\/.*$/gm, "$1");

/**
 * What the default-exported page component returns: the expression after its `=>` (`=> (` …) or,
 * for a block body, after its last `return` (`return (` …), opening parenthesis dropped.
 */
const returnedExpression = (code: string): string => {
  const name = /export default (\w+);/.exec(code)?.[1];
  const start = name === undefined ? -1 : code.indexOf(`const ${name} =`);
  if (start === -1) {
    return "";
  }
  const component = code.slice(start);
  const body = component.slice(component.indexOf("=>") + "=>".length).trimStart();
  const lastReturn = [...body.matchAll(/\breturn\b/g)].at(-1);
  const expression =
    body.startsWith("{") && lastReturn ? body.slice(lastReturn.index + "return".length) : body;
  return expression.trimStart().replace(/^\(\s*/, "");
};

const pagePatterns = new Set(PAGES.map(({ pattern }) => pattern));
const catalogPaths = new Set(ALL_ROUTES.map((route) => route.path));

describe("app tree ↔ route catalog", () => {
  it("has a page for every catalog route", () => {
    expect([...catalogPaths].filter((path) => !pagePatterns.has(path))).toEqual([]);
  });

  it("has a catalog route for every page", () => {
    expect([...pagePatterns].filter((pattern) => !catalogPaths.has(pattern))).toEqual([]);
  });
});

describe("pages under app/admin", () => {
  it.each(ADMIN_PAGES)(
    "$pattern renders one PageGuard for its own route, as the root",
    ({ pattern, file }) => {
      const code = stripComments(readFileSync(file, "utf8"));
      const guards = [...code.matchAll(GUARD)].map(([, expression]) => expression?.trim());

      expect(guards, "exactly one <PageGuard route={routes.…}>").toHaveLength(1);
      expect(ROUTE_EXPRESSIONS.get(guards[0] ?? "")?.path, `guarded by ${guards[0]}`).toBe(pattern);
      expect(returnedExpression(code), "the page returns <PageGuard> as its root").toMatch(
        /^<PageGuard\b/,
      );
    },
  );
});

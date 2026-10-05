import { describe, expect, it } from "vitest";

import { ALL_ROUTES, breadcrumbTrail, findRoute, href, routes } from "@/config/routes";
import type { AppRoute } from "@/config/routes";

const isAdminPath = (path: string): boolean => path === "/admin" || path.startsWith("/admin/");

/** The crumb a route contributes; `path` is the visited URL, not the `[id]` pattern. */
const crumb = (route: AppRoute, path: string = route.path) => ({ title: route.title, path });

describe("href", () => {
  it("returns a static path as it is", () => {
    expect(href(routes.client.list)).toBe(routes.client.list.path);
  });

  it("fills the [id] segment of a detail and an update route", () => {
    expect(href(routes.client.detail, { id: "42" })).toBe("/admin/client/42");
    expect(href(routes.workflow.update, { id: "7" })).toBe("/admin/workflow/update/7");
  });

  it("encodes the param so it stays one path segment", () => {
    expect(href(routes.user.detail, { id: "a b/c" })).toBe("/admin/master/user/a%20b%2Fc");
  });

  it("throws, naming the param, when a pattern param is missing or empty", () => {
    expect(() => href(routes.client.detail)).toThrow(/"id"/);
    expect(() => href(routes.client.update, { other: "1" })).toThrow(/"id"/);
    expect(() => href(routes.client.detail, { id: "" })).toThrow(/"id"/);
  });
});

describe("findRoute", () => {
  it("prefers the static create route over the [id] pattern", () => {
    expect(findRoute("/admin/workflow/create")).toBe(routes.workflow.create);
  });

  it("resolves an id to the detail route and update/<id> to the update route", () => {
    expect(findRoute("/admin/client/42")).toBe(routes.client.detail);
    expect(findRoute("/admin/client/update/42")).toBe(routes.client.update);
    expect(findRoute("/admin/master/user/42")).toBe(routes.user.detail);
  });

  it("ignores a trailing slash", () => {
    expect(findRoute("/admin/client/")).toBe(routes.client.list);
    expect(findRoute("/admin/")).toBe(routes.home);
  });

  it("returns undefined for paths the catalog does not know", () => {
    expect(findRoute("/nope")).toBeUndefined();
    expect(findRoute("/admin/client/42/extra")).toBeUndefined();
    expect(findRoute("/admin/settings/unknown")).toBeUndefined();
  });
});

describe("ALL_ROUTES", () => {
  it("contains the single routes and every grouped route", () => {
    expect(ALL_ROUTES).toContain(routes.home);
    expect(ALL_ROUTES).toContain(routes.profile);
    expect(ALL_ROUTES).toContain(routes.auditLog.list);
    expect(ALL_ROUTES).toContain(routes.settings.manual);
    expect(ALL_ROUTES).toContain(routes.auth.verifyEmail);
  });

  it("has no duplicate paths", () => {
    const paths = ALL_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("protects every /admin route and keeps every auth route public", () => {
    for (const route of ALL_ROUTES.filter((candidate) => isAdminPath(candidate.path))) {
      expect(route.access, route.path).not.toBe("public");
    }
    for (const route of Object.values(routes.auth)) {
      expect(route.access, route.path).toBe("public");
    }
  });

  it("has no route outside /admin except the auth routes", () => {
    expect(ALL_ROUTES.filter((route) => !isAdminPath(route.path))).toEqual(
      Object.values(routes.auth),
    );
  });

  it("asks create for /create, update for /update/[id] and read for every other gated page", () => {
    for (const route of ALL_ROUTES) {
      if (typeof route.access === "string") {
        continue;
      }
      const expected = route.path.endsWith("/create")
        ? "create"
        : route.path.includes("/update/")
          ? "update"
          : "read";
      expect(route.access.action, route.path).toBe(expected);
    }
  });
});

describe("breadcrumbTrail", () => {
  it("is just ホーム on /admin", () => {
    expect(breadcrumbTrail("/admin")).toEqual([crumb(routes.home)]);
  });

  it("never resolves an intermediate `update` segment to the [id] detail route", () => {
    expect(breadcrumbTrail("/admin/workflow/update/42")).toEqual([
      crumb(routes.home),
      crumb(routes.workflow.list),
      crumb(routes.workflow.update, "/admin/workflow/update/42"),
    ]);
  });

  it("skips prefixes without a page (/admin/master)", () => {
    expect(breadcrumbTrail("/admin/master/user/42")).toEqual([
      crumb(routes.home),
      crumb(routes.user.list),
      crumb(routes.user.detail, "/admin/master/user/42"),
    ]);
    expect(breadcrumbTrail("/admin/master/workflow/template/update/7")).toEqual([
      crumb(routes.home),
      crumb(routes.workflowTemplate.list),
      crumb(routes.workflowTemplate.update, "/admin/master/workflow/template/update/7"),
    ]);
  });

  it("drops an unknown last segment", () => {
    expect(breadcrumbTrail("/admin/settings/unknown")).toEqual([crumb(routes.home)]);
  });

  it("ignores a trailing slash", () => {
    expect(breadcrumbTrail("/admin/client/")).toEqual([
      crumb(routes.home),
      crumb(routes.client.list),
    ]);
  });
});

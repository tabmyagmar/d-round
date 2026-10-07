import type { Action, SubjectName } from "@repo/permissions";

/**
 * THE route catalog: the only place a path or a page title is written. Links use
 * `href(routes.…)`, the nav (`config/nav.ts`) references routes, and the sidebar and the server
 * page guard both decide access with `canAccessRoute` (`lib/auth/route-access.ts`). Paths and
 * titles mirror the legacy d-round-web app 1:1 under `/admin`.
 */

/** Who may open a page: anyone, any signed-in user, or a user allowed `action` on every row. */
export type RouteAccess = "public" | "signed-in" | { action: Action; subject: SubjectName };

/** One page; `path` is the Next.js pattern (`[id]` marks a dynamic segment). */
export type AppRoute = { path: string; title: string; access: RouteAccess };

/** One crumb of the header trail; `path` is the visited URL, `route` the page it renders. */
export type Breadcrumb = { path: string; route: AppRoute };

const allow = (action: Action, subject: SubjectName): RouteAccess => ({ action, subject });

// A top-level entry is either one route (`routes.profile`) or a group of routes
// (`routes.client.list`); `ALL_ROUTES` flattens both shapes.
export const routes = {
  auth: {
    login: { path: "/login", title: "ログイン", access: "public" },
    forgotPassword: { path: "/forgot-password", title: "パスワード再設定する", access: "public" },
    // Also mailed by the API: apps/api/src/core/web-links.ts mirrors this path.
    newPassword: { path: "/new-password", title: "パスワード設定", access: "public" },
  },
  profile: { path: "/admin/profile", title: "プロフィール", access: "signed-in" },
  workflow: {
    list: { path: "/admin/workflow", title: "ワークフロー", access: allow("read", "Workflow") },
    detail: {
      path: "/admin/workflow/[id]",
      title: "申請書詳細",
      access: allow("read", "Workflow"),
    },
    create: {
      path: "/admin/workflow/create",
      title: "申請書を作成",
      access: allow("create", "Workflow"),
    },
    update: {
      path: "/admin/workflow/update/[id]",
      title: "申請書を編集",
      access: allow("update", "Workflow"),
    },
  },
  workflowTemplate: {
    list: {
      path: "/admin/master/workflow/template",
      title: "ワークフロー管理",
      access: allow("read", "WorkflowTemplate"),
    },
    create: {
      path: "/admin/master/workflow/template/create",
      title: "申請書書式作成",
      access: allow("create", "WorkflowTemplate"),
    },
    update: {
      path: "/admin/master/workflow/template/update/[id]",
      title: "申請書書式編集",
      access: allow("update", "WorkflowTemplate"),
    },
  },
  user: {
    list: { path: "/admin/master/user", title: "担当者管理", access: allow("read", "User") },
    detail: {
      path: "/admin/master/user/[id]",
      title: "担当者情報詳細",
      access: allow("read", "User"),
    },
    create: {
      path: "/admin/master/user/create",
      title: "担当者追加",
      access: allow("create", "User"),
    },
    update: {
      path: "/admin/master/user/update/[id]",
      title: "担当者情報編集",
      access: allow("update", "User"),
    },
  },
  auditLog: {
    list: {
      path: "/admin/master/log",
      title: "アクセスログ管理",
      access: allow("read", "AuditLog"),
    },
  },
  client: {
    list: { path: "/admin/client", title: "クライアント管理", access: allow("read", "Client") },
    detail: {
      path: "/admin/client/[id]",
      title: "クライアント情報詳細",
      access: allow("read", "Client"),
    },
    create: {
      path: "/admin/client/create",
      title: "クライアント追加",
      access: allow("create", "Client"),
    },
    update: {
      path: "/admin/client/update/[id]",
      title: "クライアント情報編集",
      access: allow("update", "Client"),
    },
  },
  branch: {
    list: { path: "/admin/branch", title: "就業先部署", access: allow("read", "Branch") },
    detail: {
      path: "/admin/branch/[id]",
      title: "就業先部署詳細",
      access: allow("read", "Branch"),
    },
    create: {
      path: "/admin/branch/create",
      title: "就業先部署追加",
      access: allow("create", "Branch"),
    },
    update: {
      path: "/admin/branch/update/[id]",
      title: "就業先部署編集",
      access: allow("update", "Branch"),
    },
  },
  staff: {
    list: { path: "/admin/staff", title: "スタッフ管理", access: allow("read", "Staff") },
    detail: { path: "/admin/staff/[id]", title: "スタッフ詳細", access: allow("read", "Staff") },
    create: {
      path: "/admin/staff/create",
      title: "スタッフ追加",
      access: allow("create", "Staff"),
    },
    update: {
      path: "/admin/staff/update/[id]",
      title: "スタッフ情報編集",
      access: allow("update", "Staff"),
    },
  },
  settings: {
    privacy: { path: "/admin/settings/privacy", title: "定型文管理", access: "signed-in" },
    manual: { path: "/admin/settings/manual", title: "マニュアル", access: "signed-in" },
    help: { path: "/admin/settings/help", title: "操作方法", access: "signed-in" },
  },
} as const satisfies Record<string, AppRoute | Record<string, AppRoute>>;

/** Where a signed-in user lands: after login, from `/admin`, and the way back from a 403 or 404. */
export const LANDING_ROUTE = routes.workflow.list;

type RouteGroup = Readonly<Record<string, AppRoute>>;

const isRoute = (entry: AppRoute | RouteGroup): entry is AppRoute => typeof entry.path === "string";

/** Every route of the catalog, flattened. */
export const ALL_ROUTES: readonly AppRoute[] = Object.values<AppRoute | RouteGroup>(routes).flatMap(
  (entry) => (isRoute(entry) ? [entry] : Object.values(entry)),
);

const PARAM = /\[([^\]]+)\]/g;

const isPattern = (path: string): boolean => path.includes("[");

const segmentsOf = (path: string): string[] => path.split("/").filter(Boolean);

/** `/admin/client/` → `/admin/client`; the root stays `/`. */
const normalize = (pathname: string): string => pathname.replace(/\/+$/, "") || "/";

const STATIC_ROUTES = new Map(
  ALL_ROUTES.filter((route) => !isPattern(route.path)).map((route) => [route.path, route]),
);

const PATTERN_ROUTES = ALL_ROUTES.filter((route) => isPattern(route.path));

const matchesPattern = (pattern: string, pathname: string): boolean => {
  const expected = segmentsOf(pattern);
  const actual = segmentsOf(pathname);
  return (
    expected.length === actual.length &&
    expected.every((segment, index) => isPattern(segment) || segment === actual[index])
  );
};

/** The URL of a route: each `[name]` is filled with the encoded `params[name]`. */
export const href = (route: AppRoute, params: Readonly<Record<string, string>> = {}): string =>
  route.path.replaceAll(PARAM, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") {
      throw new Error(`href(${route.path}): missing route param "${name}"`);
    }
    return encodeURIComponent(value);
  });

/**
 * The catalog route a pathname renders, trailing slash ignored: an exact static match first (so
 * `/admin/workflow/create` is the create page, not the detail of id `create`), then the `[id]`
 * patterns with the same number of segments.
 */
export const findRoute = (pathname: string): AppRoute | undefined => {
  const path = normalize(pathname);
  return (
    STATIC_ROUTES.get(path) ?? PATTERN_ROUTES.find((route) => matchesPattern(route.path, path))
  );
};

/**
 * The header trail of a pathname: one crumb per prefix that is a page. Intermediate prefixes
 * match static routes only (`/admin/workflow/update` is not the detail of id `update`); the full
 * pathname goes through `findRoute`; `/admin` has no page, so the trail starts below it.
 * `/admin/workflow/update/42` → ワークフロー › 申請書を編集.
 */
export const breadcrumbTrail = (pathname: string): Breadcrumb[] => {
  const segments = segmentsOf(normalize(pathname));
  return segments.flatMap((_segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    const route = index === segments.length - 1 ? findRoute(path) : STATIC_ROUTES.get(path);
    return route ? [{ path, route }] : [];
  });
};

// Tab, LF and CR are removed anywhere in a URL by the WHATWG parser, so `/<tab>/host` is `//host`.
const URL_STRIPPED = /[\t\n\r]/;

/**
 * `next` when it is a same-origin path, otherwise `fallback` — the guard against open redirects
 * after sign-in. Only a string qualifies (`?next=a&next=b` arrives as an array). A same-origin
 * path starts with exactly one `/`; a second `/` or `\` makes it protocol-relative (browsers
 * treat `/\host` like `//host`), and a tab or newline the URL parser strips could produce one.
 * Absolute URLs (`https:`, `javascript:`) and relative paths fall back.
 */
export const safeNextPath = (next: unknown, fallback: string): string =>
  typeof next === "string" &&
  next.startsWith("/") &&
  next[1] !== "/" &&
  next[1] !== "\\" &&
  !URL_STRIPPED.test(next)
    ? next
    : fallback;

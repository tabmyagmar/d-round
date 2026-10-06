import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

const ORIGIN = "http://localhost:3000";

/** Better Auth's session cookie under its default name, the one `getSessionCookie` looks for. */
const SESSION_COOKIE = "better-auth.session_token=test-token";

/** A request for `path`, carrying the session cookie when `signedIn`. */
const requestFor = (path: string, signedIn: boolean): NextRequest =>
  new NextRequest(new URL(path, ORIGIN), signedIn ? { headers: { cookie: SESSION_COOKIE } } : {});

const locationOf = (response: Response): URL | null => {
  const location = response.headers.get("location");
  return location === null ? null : new URL(location);
};

describe("proxy", () => {
  describe("without a session cookie", () => {
    it.each(["/admin", "/admin/"])("sends %s to login with the landing page as next", (path) => {
      const response = proxy(requestFor(path, false));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fadmin%2Fworkflow`);
    });

    it("sends any other /admin page to login with its path and query as next", () => {
      const location = locationOf(proxy(requestFor("/admin/client?page=2", false)));
      expect(location?.pathname).toBe("/login");
      expect(location?.searchParams.get("next")).toBe("/admin/client?page=2");
    });
  });

  describe("with a session cookie", () => {
    it.each(["/admin", "/admin/"])("redirects %s to the landing page", (path) => {
      const response = proxy(requestFor(path, true));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/workflow`);
    });

    it("lets any other /admin page through", () => {
      const response = proxy(requestFor("/admin/client", true));
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).toBe(200);
    });
  });
});

import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { href, LANDING_ROUTE, routes } from "@/config/routes";

/** `/admin` (the shell prefix, which the matcher also covers) has no page of its own. */
const SHELL_ROOT = /^\/admin\/?$/;

/**
 * Optimistic redirect for signed-out visitors (cookie presence only, as Better Auth
 * recommends), and `/admin` → the landing page. Real authorization happens in the /admin layout
 * (server-side session), the page guard (ability) and, always, in the API.
 */
export const proxy = (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;
  const target = SHELL_ROOT.test(pathname) ? href(LANDING_ROUTE) : undefined;
  if (!getSessionCookie(request)) {
    const login = new URL(href(routes.auth.login), request.url);
    login.searchParams.set("next", target ?? `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return target === undefined
    ? NextResponse.next()
    : NextResponse.redirect(new URL(target, request.url));
};

export const config = {
  matcher: ["/admin/:path*"],
};

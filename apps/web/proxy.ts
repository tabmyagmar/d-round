import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { href, routes } from "@/config/routes";

/**
 * Optimistic redirect for signed-out visitors (cookie presence only, as Better Auth
 * recommends). Real authorization happens in the /admin layout (server-side session), the page
 * guard (ability) and, always, in the API.
 */
export const proxy = (request: NextRequest) => {
  if (!getSessionCookie(request)) {
    const login = new URL(href(routes.auth.login), request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/admin/:path*"],
};

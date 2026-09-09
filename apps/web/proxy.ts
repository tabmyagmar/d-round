import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors (cookie presence only, as Better Auth
 * recommends). Real authorization happens in the (app) layout (server-side session) and,
 * always, in the API.
 */
export const proxy = (request: NextRequest) => {
  if (!getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/dashboard/:path*", "/users/:path*", "/profile/:path*"],
};

import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AccessDenied } from "@/components/access-denied";
import { href, routes } from "@/config/routes";
import type { AppRoute } from "@/config/routes";
import { routeDecision } from "@/lib/auth/route-access";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Server-side gate around the content of every page under /admin: renders the page, the in-place
 * 403 or a redirect to login — decided before any HTML reaches the browser, by the same rule the
 * sidebar uses (`routeDecision` → `canAccessRoute`). UI only: the API re-checks every request.
 */
export const PageGuard = async ({
  route,
  children,
}: {
  route: AppRoute;
  children: ReactNode;
}): Promise<ReactNode> => {
  const user = await getCurrentUser();
  switch (routeDecision(user, route)) {
    case "sign-in": {
      return redirect(href(routes.auth.login));
    }
    case "forbidden": {
      return <AccessDenied />;
    }
    case "allow": {
      return children;
    }
  }
};

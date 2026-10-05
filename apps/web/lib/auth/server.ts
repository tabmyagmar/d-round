import { headers } from "next/headers";
import { cache } from "react";

import type { PermissionGrant } from "@repo/permissions";
import { DEFAULT_ROLE, roleSchema } from "@repo/validation";
import type { Role } from "@repo/validation";

import type { Session } from "@/lib/auth/client";
import { publicEnv } from "@/lib/env";

/**
 * Server-side session lookup for server components, layouts and route handlers: forwards the
 * browser's cookies to the API's Better Auth endpoint. React `cache()` dedupes it within one
 * request (layout + page guard share one call); the fetch itself is never cached.
 */
export const getServerSession = cache(async (): Promise<Session | null> => {
  const cookie = (await headers()).get("cookie");
  if (!cookie) {
    return null;
  }
  try {
    const response = await fetch(`${publicEnv.apiUrl}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Session | null;
  } catch {
    return null;
  }
});

/** The subset of the session the ability rules and the shell need. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Effective grants from the session — what `AbilityProvider` / `defineAbilityFor` read. */
  permissions: PermissionGrant[];
};

export const toCurrentUser = (session: Session): CurrentUser => {
  const role = roleSchema.safeParse(session.user.role);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: role.success ? role.data : DEFAULT_ROLE,
    permissions: session.user.permissions,
  };
};

/** The signed-in user of this request, or null; one session fetch per request (`cache()`). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession();
  return session ? toCurrentUser(session) : null;
});

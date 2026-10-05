import {
  adminClient,
  customSessionClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "./access-control";
import type { Auth } from "./server";

/**
 * Browser client. `baseURL` is the API origin; cookies travel with `credentials: "include"`.
 * `inferAdditionalFields<Auth>()` and `customSessionClient<Auth>()` are type-only references to
 * the server config (the latter makes `useSession` see `user.permissions`), so the server code
 * never ends up in the bundle.
 */
export const createAuthReactClient = (baseURL: string) =>
  createAuthClient({
    baseURL,
    basePath: "/api/auth",
    fetchOptions: { credentials: "include" },
    plugins: [
      inferAdditionalFields<Auth>(),
      customSessionClient<Auth>(),
      adminClient({ ac, roles }),
    ],
  });

export type AuthClient = ReturnType<typeof createAuthReactClient>;

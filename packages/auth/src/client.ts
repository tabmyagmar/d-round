import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "./access-control";
import type { Auth } from "./server";

/**
 * Browser client. `baseURL` is the API origin; cookies travel with `credentials: "include"`.
 * `inferAdditionalFields<Auth>()` is a type-only reference to the server config, so the
 * server code never ends up in the bundle.
 */
export const createAuthReactClient = (baseURL: string) =>
  createAuthClient({
    baseURL,
    basePath: "/api/auth",
    fetchOptions: { credentials: "include" },
    plugins: [inferAdditionalFields<Auth>(), adminClient({ ac, roles })],
  });

export type AuthClient = ReturnType<typeof createAuthReactClient>;

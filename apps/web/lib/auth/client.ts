import { createAuthReactClient } from "@repo/auth/client";
import type { AuthClient } from "@repo/auth/client";

import { publicEnv } from "@/lib/env";

/** Better Auth browser client bound to the API origin (cookies travel with every call). */
export const authClient: AuthClient = createAuthReactClient(publicEnv.apiUrl);

export type Session = AuthClient["$Infer"]["Session"];
export type SessionUser = Session["user"];

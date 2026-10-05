import type { Auth, SessionUser } from "@repo/auth";
import type { PrismaClient } from "@repo/database";
import { childLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import type { PermissionGrant } from "@repo/permissions";
import { definePrismaAbilityFor } from "@repo/permissions/server";
import type { ServerAbility } from "@repo/permissions/server";
import type { RedisConnection } from "@repo/queue";
import { DEFAULT_ROLE, roleSchema } from "@repo/validation";
import type { Role } from "@repo/validation";

export const REQUEST_ID_HEADER = "x-request-id";

/** The signed-in user as services see it (normalised from the Better Auth session). */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  /** Effective grants from the session (`customSession`); the rules validate them, not this. */
  permissions: PermissionGrant[];
};

/**
 * Everything a service needs, built once per request. Transports (tRPC now, GraphQL/REST
 * later) only wrap this; they never build their own context.
 */
export type RequestContext = {
  requestId: string;
  logger: Logger;
  /** Raw request headers — needed to call Better Auth's admin API on behalf of the caller. */
  headers: Headers;
  user: AuthUser | null;
  ability: ServerAbility;
  db: PrismaClient;
  redis: RedisConnection;
  auth: Auth;
};

export type ContextDeps = {
  logger: Logger;
  db: PrismaClient;
  redis: RedisConnection;
  auth: Auth;
};

export type ContextInput = {
  headers: Headers;
  /** Request id already assigned by the HTTP layer; falls back to the header, then a UUID. */
  requestId?: string;
};

export const toAuthUser = (user: SessionUser): AuthUser => {
  const role = roleSchema.safeParse(user.role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: role.success ? role.data : DEFAULT_ROLE,
    emailVerified: user.emailVerified,
    permissions: user.permissions.map(({ action, subject }) => ({ action, subject })),
  };
};

export const buildRequestContext = async (
  input: ContextInput,
  deps: ContextDeps,
): Promise<RequestContext> => {
  const requestId = input.requestId ?? input.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  const session = await deps.auth.api.getSession({ headers: input.headers });
  const user = session ? toAuthUser(session.user) : null;

  return {
    requestId,
    logger: childLogger(deps.logger, { requestId, userId: user?.id ?? null }),
    headers: input.headers,
    user,
    ability: definePrismaAbilityFor(user),
    db: deps.db,
    redis: deps.redis,
    auth: deps.auth,
  };
};

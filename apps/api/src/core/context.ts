import type { PrismaClient } from "@repo/database";
import { childLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import type { RedisConnection } from "@repo/queue";

export const REQUEST_ID_HEADER = "x-request-id";

/** Placeholder until Better Auth lands (Phase 1). */
export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

/** Placeholder until CASL lands (Phase 1). */
export type Ability = null;

/**
 * Everything a service needs, built once per request. Transports (tRPC now, GraphQL/REST
 * later) only wrap this; they never build their own context.
 */
export type RequestContext = {
  requestId: string;
  logger: Logger;
  user: AuthUser | null;
  ability: Ability;
  db: PrismaClient;
  redis: RedisConnection;
};

export type ContextDeps = {
  logger: Logger;
  db: PrismaClient;
  redis: RedisConnection;
};

export type ContextInput = {
  headers: Headers;
  /** Request id already assigned by the HTTP layer; falls back to the header, then a UUID. */
  requestId?: string;
};

export const buildRequestContext = (input: ContextInput, deps: ContextDeps): RequestContext => {
  const requestId = input.requestId ?? input.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  return {
    requestId,
    logger: childLogger(deps.logger, { requestId }),
    user: null,
    ability: null,
    db: deps.db,
    redis: deps.redis,
  };
};

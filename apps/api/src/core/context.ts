import type { Auth, SessionUser } from "@repo/auth";
import { createPermissionRepository, createUserRepository } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { childLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import type { PermissionGrant } from "@repo/permissions";
import { definePrismaAbilityFor } from "@repo/permissions/server";
import type { ServerAbility } from "@repo/permissions/server";
import type { AttachmentDeleteQueue, CsvImportQueue, RedisConnection } from "@repo/queue";
import type { StorageProvider } from "@repo/storage";
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
  /** The web app's origin: CORS, and the links the API puts in mails (`core/web-links.ts`). */
  webOrigin: string;
  /** The attachments bucket: signed URLs, head, delete (ADR 0012). */
  storage: StorageProvider;
  /** Object deletes run in the worker; services enqueue them after commit. */
  attachmentDeleteQueue: AttachmentDeleteQueue;
  /** CSV checks and imports run in the worker; the CSV service enqueues them after commit. */
  csvImportQueue: CsvImportQueue;
};

export type ContextDeps = {
  logger: Logger;
  db: PrismaClient;
  redis: RedisConnection;
  auth: Auth;
  /** Browser origin allowed to call the API with cookies; also the base of mailed links. */
  webOrigin: string;
  storage: StorageProvider;
  attachmentDeleteQueue: AttachmentDeleteQueue;
  csvImportQueue: CsvImportQueue;
};

export type ContextInput = {
  headers: Headers;
  /** Request id already assigned by the HTTP layer; falls back to the header, then a UUID. */
  requestId?: string;
};

/** What `toAuthUser` reads: a Better Auth session's user, or a user row with its grants (jobs). */
export type AuthUserSource = Pick<SessionUser, "id" | "email" | "name" | "emailVerified"> & {
  role?: string | null | undefined;
  permissions: readonly { action: string; subject: string }[];
};

export const toAuthUser = (user: AuthUserSource): AuthUser => {
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
    webOrigin: deps.webOrigin,
    storage: deps.storage,
    attachmentDeleteQueue: deps.attachmentDeleteQueue,
    csvImportQueue: deps.csvImportQueue,
  };
};

export type JobContextInput = {
  /** The user the job acts for: a CSV import's uploader. */
  userId: string;
  /** The request that started the work (`ctx.requestId`), kept as the job's request id. */
  traceId?: string | undefined;
};

/**
 * The context a background job runs its service calls in (docs/adr/0013-csv-import.md): the
 * services see the user who started the work, with the grants that user holds **now** — a revoked
 * permission stops the job's writes, as it would stop their next request. Null when the user can no
 * longer sign in (deactivated or banned). There are no request headers: services that call Better
 * Auth's admin API do so server-side, without a session.
 */
export const buildJobContext = async (
  input: JobContextInput,
  deps: ContextDeps,
): Promise<RequestContext | null> => {
  const found = await createUserRepository(deps.db).findById(input.userId);
  if (!found || found.banned === true) {
    return null;
  }
  const grants = await createPermissionRepository(deps.db).findEffectiveGrants(
    found.id,
    found.role,
  );
  const user = toAuthUser({
    ...found,
    permissions: grants.map(({ action, modelName }) => ({ action, subject: modelName })),
  });
  const requestId = input.traceId ?? crypto.randomUUID();

  return {
    requestId,
    logger: childLogger(deps.logger, { requestId, userId: user.id }),
    headers: new Headers(),
    user,
    ability: definePrismaAbilityFor(user),
    db: deps.db,
    redis: deps.redis,
    auth: deps.auth,
    webOrigin: deps.webOrigin,
    storage: deps.storage,
    attachmentDeleteQueue: deps.attachmentDeleteQueue,
    csvImportQueue: deps.csvImportQueue,
  };
};

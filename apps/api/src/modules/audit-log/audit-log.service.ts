import type { AuthAuditEvent } from "@repo/auth";
import { createAuditLogRepository, createUserRepository } from "@repo/database";
import type {
  AuditLog,
  AuditLogData,
  AuditLogHistoryPage,
  AuditLogListItem,
  DbClient,
  PageResult,
  Prisma,
} from "@repo/database";
import { TIME_ZONE, dayjs } from "@repo/dayjs";
import type { Logger } from "@repo/logger";
import { canUnscoped } from "@repo/permissions/server";
import { AUDIT_ACTIONS, AUDIT_HISTORY_PAGE_SIZE, isAuditAction } from "@repo/validation";
import type {
  AuditAction,
  AuditChange,
  AuditEntityType,
  AuditLogHistoryInput,
  ListAuditLogsQuery,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, NotFoundError } from "../../core/errors";

/**
 * アクセスログ (docs/adr/0015-audit-log.md). A write records the entities it changed inside its own
 * transaction (`recordChanges`), so a change commits with its row or not at all. A failed mutation
 * (`recordFailure`) and a Better Auth event (`recordAuthEvent`) are recorded outside any transaction,
 * and never fail what they record.
 */

/** An entity as the log shows it: field key → the value as the screens display it ("" for none). */
export type AuditView = Readonly<Record<string, string>>;

/** One entity a write changed. */
export type AuditEntry = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** What the entity is called (`1024 株式会社サンプル`); the row keeps it after a delete. */
  entityLabel: string;
  changes: AuditChange[];
};

/** A longer value is cut, so a row stays small whatever a free-text field holds. */
export const AUDIT_VALUE_MAX_LENGTH = 500;

const USER_AGENT_MAX_LENGTH = 512;

const valueOf = (value: string | undefined): string | null =>
  value === undefined || value === "" ? null : value;

const cut = (value: string | null): string | null =>
  value === null ? null : value.slice(0, AUDIT_VALUE_MAX_LENGTH);

const isLong = (value: string | null): boolean =>
  value !== null && value.length > AUDIT_VALUE_MAX_LENGTH;

/**
 * The fields whose value differs between two views of an entity, in the view's order: a create (no
 * before) lists every filled field, a delete (no after) none. A field in `masked` records that it
 * changed, never its values.
 */
export const diffViews = (
  before: AuditView | null,
  after: AuditView | null,
  masked: ReadonlySet<string> = new Set(),
): AuditChange[] => {
  if (after === null) {
    return [];
  }
  const changes: AuditChange[] = [];
  for (const field of Object.keys(after)) {
    const was = before === null ? null : valueOf(before[field]);
    const now = valueOf(after[field]);
    if (was === now) {
      continue;
    }
    if (masked.has(field)) {
      changes.push({ field, masked: true });
    } else if (isLong(was) || isLong(now)) {
      changes.push({ field, before: cut(was), after: cut(now), truncated: true });
    } else {
      changes.push({ field, before: was, after: now });
    }
  }
  return changes;
};

/** Who acted and from where, as a row keeps it: the signed-in user, or the system in a job. */
const sourceOf = (ctx: RequestContext) =>
  ({
    actorType: ctx.user ? "USER" : "SYSTEM",
    actorId: ctx.user?.id ?? null,
    actorName: ctx.user?.name ?? null,
    actorEmail: ctx.user?.email ?? null,
    actorRole: ctx.user?.role ?? null,
    requestId: ctx.requestId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
  }) satisfies Partial<AuditLogData>;

/** Records the entities a write changed; call it inside the write's transaction, with its `tx`. */
export const recordChanges = async (
  ctx: RequestContext,
  db: DbClient,
  entries: readonly AuditEntry[],
): Promise<void> => {
  const source = sourceOf(ctx);
  await createAuditLogRepository(db).createMany(
    entries.map((entry) => ({ ...source, ...entry, status: "SUCCESS" })),
  );
};

/**
 * Records a failed mutation (`action` is its tRPC path) with its error code. Never throws: a row it
 * cannot write is logged, and the failure reaches the caller as it was.
 */
export const recordFailure = async (
  ctx: RequestContext,
  action: string,
  errorCode: string,
): Promise<void> => {
  try {
    await createAuditLogRepository(ctx.db).create({
      ...sourceOf(ctx),
      action,
      entityType: isAuditAction(action) ? AUDIT_ACTIONS[action].entityType : null,
      status: "FAILURE",
      errorCode,
    });
  } catch (error) {
    ctx.logger.error({ err: error, action, errorCode }, "audit log row not written");
  }
};

/** What recording a Better Auth event needs: it runs outside any request context. */
export type AuthEventDeps = { db: DbClient; logger: Logger };

/** An `/admin/*` call's changes: the endpoint and, for a role change, the role it gives. */
const adminChangesOf = (event: AuthAuditEvent): AuditChange[] => [
  { field: "endpoint", before: null, after: event.endpoint },
  ...(event.role === null ? [] : [{ field: "role", before: null, after: event.role }]),
];

/**
 * Records a sign-in, sign-out, password or admin-endpoint event (`createAuth`'s `onAuthEvent`). The
 * target is the user the event concerns: the actor, or the user an admin endpoint acted on. Never
 * throws.
 */
export const recordAuthEvent = async (
  deps: AuthEventDeps,
  event: AuthAuditEvent,
): Promise<void> => {
  try {
    const target = event.targetUserId
      ? await createUserRepository(deps.db).findByIdIncludingDeleted(event.targetUserId)
      : null;
    await createAuditLogRepository(deps.db).create({
      actorType: event.user ? "USER" : "ANONYMOUS",
      actorId: event.user?.id ?? null,
      actorName: event.user?.name ?? null,
      actorEmail: event.user?.email ?? event.email,
      actorRole: event.user?.role ?? null,
      action: event.action,
      entityType: "User",
      entityId: event.targetUserId ?? event.user?.id ?? null,
      entityLabel: target?.name ?? event.user?.name ?? event.email,
      status: event.status,
      errorCode: event.errorCode,
      ...(event.action === "auth.admin" ? { changes: adminChangesOf(event) } : {}),
      requestId: event.requestId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    });
  } catch (error) {
    deps.logger.error({ err: error, action: event.action }, "audit log row not written");
  }
};

/**
 * Reading the log needs `read AuditLog` (catalog row 1502: super_admin and admin) for every row:
 * there is no row rule, and the history of an entity shows its actors, addresses and failures.
 */
const assertMayRead = (ctx: RequestContext): void => {
  if (!canUnscoped(ctx.ability, "read", "AuditLog")) {
    throw new ForbiddenError("Not allowed to read the audit log");
  }
};

/** A day of the period filter, in Japan: its first moment, and the first of the next day. */
const dayStart = (isoDay: string): Date => dayjs.tz(isoDay, TIME_ZONE).toDate();
const nextDayStart = (isoDay: string): Date => dayjs.tz(isoDay, TIME_ZONE).add(1, "day").toDate();

/** 「アクセスログ管理」: the rows the search and the filters match, newest first, without changes. */
export const list = async (
  ctx: RequestContext,
  query: ListAuditLogsQuery,
): Promise<PageResult<AuditLogListItem>> => {
  assertMayRead(ctx);
  const filters: Prisma.AuditLogWhereInput[] = [];
  if (query.search) {
    filters.push({
      OR: [
        { actorName: { contains: query.search } },
        { actorEmail: { contains: query.search, mode: "insensitive" } },
        { entityLabel: { contains: query.search } },
      ],
    });
  }
  if (query.actions?.length) {
    filters.push({ action: { in: query.actions } });
  }
  if (query.entityTypes?.length) {
    filters.push({ entityType: { in: query.entityTypes } });
  }
  if (query.statuses?.length) {
    filters.push({ status: { in: query.statuses } });
  }
  if (query.from) {
    filters.push({ createdAt: { gte: dayStart(query.from) } });
  }
  if (query.to) {
    filters.push({ createdAt: { lt: nextDayStart(query.to) } });
  }
  return createAuditLogRepository(ctx.db).findPage(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
  );
};

/** One row with its changed fields (the list's detail). */
export const getById = async (ctx: RequestContext, auditLogId: string): Promise<AuditLog> => {
  assertMayRead(ctx);
  const row = await createAuditLogRepository(ctx.db).findById(auditLogId);
  if (!row) {
    throw new NotFoundError("AuditLog", auditLogId);
  }
  return row;
};

/** A 担当者's sign-ins and sign-outs change nothing: アクセスログ管理 lists them, the history not. */
const NOT_CHANGES: readonly AuditAction[] = ["auth.signIn", "auth.signOut"];

/** An entity's 「変更履歴」: its rows newest first, `AUDIT_HISTORY_PAGE_SIZE` at a time. */
export const history = async (
  ctx: RequestContext,
  input: AuditLogHistoryInput,
): Promise<AuditLogHistoryPage> => {
  assertMayRead(ctx);
  return createAuditLogRepository(ctx.db).findHistory(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      action: { notIn: [...NOT_CHANGES] },
    },
    { cursor: input.cursor, take: AUDIT_HISTORY_PAGE_SIZE },
  );
};

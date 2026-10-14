import type { AuthAuditEvent } from "@repo/auth";
import { createAuditLogRepository, createUserRepository } from "@repo/database";
import type { AuditLogData, DbClient } from "@repo/database";
import type { Logger } from "@repo/logger";
import { AUDIT_ACTIONS, isAuditAction } from "@repo/validation";
import type { AuditAction, AuditChange, AuditEntityType } from "@repo/validation";

import type { RequestContext } from "../../core/context";

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

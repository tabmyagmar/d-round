import type { AuditLog, Prisma } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/** A row as a writer hands it over; the id and the time come from the database. */
export type AuditLogData = Prisma.AuditLogCreateManyInput;

/** A row as the list shows it: without the changed fields, which the detail loads. */
export type AuditLogListItem = Omit<AuditLog, "changes">;

/** One page of an entity's history, newest first, and the cursor of the next page. */
export type AuditLogHistoryPage = { items: AuditLog[]; nextCursor: string | null };

const LIST_SELECT = {
  id: true,
  createdAt: true,
  actorType: true,
  actorId: true,
  actorName: true,
  actorEmail: true,
  actorRole: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  status: true,
  errorCode: true,
  requestId: true,
  ipAddress: true,
  userAgent: true,
} as const satisfies Prisma.AuditLogSelect;

const NEWEST_FIRST: Prisma.AuditLogOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/**
 * アクセスログ (docs/adr/0015-audit-log.md). Append-only: rows are created and read; the one delete
 * is the sweeper's, of rows past the retention — the database refuses any other.
 */
export const createAuditLogRepository = (db: DbClient) => ({
  create: (data: AuditLogData): Promise<AuditLog> => db.auditLog.create({ data }),

  createMany: async (data: AuditLogData[]): Promise<number> =>
    data.length === 0 ? 0 : (await db.auditLog.createMany({ data })).count,

  findById: (id: string): Promise<AuditLog | null> => db.auditLog.findUnique({ where: { id } }),

  /** The rows `where` matches (the service builds it from the list's filters), newest first. */
  findPage: async (
    params: Partial<PageParams>,
    where: Prisma.AuditLogWhereInput,
  ): Promise<PageResult<AuditLogListItem>> => {
    const page = normalizePage(params);
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        select: LIST_SELECT,
        ...toSkipTake(page),
        orderBy: NEWEST_FIRST,
      }),
      db.auditLog.count({ where }),
    ]);
    return buildPage(items, total, page);
  },

  /** One entity's rows, newest first: `take` of them after the row `cursor` names. */
  findHistory: async (
    entity: { entityType: string; entityId: string },
    page: { cursor?: string | null | undefined; take: number },
  ): Promise<AuditLogHistoryPage> => {
    const rows = await db.auditLog.findMany({
      where: entity,
      orderBy: NEWEST_FIRST,
      take: page.take + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, page.take);
    return { items, nextCursor: rows.length > page.take ? (items.at(-1)?.id ?? null) : null };
  },

  /** Deletes up to `limit` rows created before `cutoff`, oldest first; returns how many. */
  deleteOlderThan: async (cutoff: Date, limit: number): Promise<number> => {
    const rows = await db.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    if (rows.length === 0) {
      return 0;
    }
    const { count } = await db.auditLog.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return count;
  },
});

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>;

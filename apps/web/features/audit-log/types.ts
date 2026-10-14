import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type AuditLogOutputs = inferRouterOutputs<AppRouter>["auditLog"];

/** A row of `auditLog.list`: everything but the changed fields (superjson keeps the dates). */
export type AuditLogRow = AuditLogOutputs["list"]["items"][number];

/** `auditLog.byId`: one row with its changed fields. */
export type AuditLogDetail = AuditLogOutputs["byId"];

/** `auditLog.history`: one page of an entity's 変更履歴 and the cursor of the next. */
export type AuditHistoryPage = AuditLogOutputs["history"];

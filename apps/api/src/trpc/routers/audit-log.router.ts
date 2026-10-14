import { auditLogHistorySchema, auditLogIdSchema, listAuditLogsSchema } from "@repo/validation";

import * as auditLogService from "../../modules/audit-log/audit-log.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. The audit log is read only; rows are written by the writes. */
export const auditLogRouter = router({
  list: protectedProcedure
    .use(requireAbility("read", "AuditLog"))
    .input(listAuditLogsSchema)
    .query(({ ctx, input }) => auditLogService.list(ctx, input)),

  byId: protectedProcedure
    .use(requireAbility("read", "AuditLog"))
    .input(auditLogIdSchema)
    .query(({ ctx, input }) => auditLogService.getById(ctx, input.auditLogId)),

  history: protectedProcedure
    .use(requireAbility("read", "AuditLog"))
    .input(auditLogHistorySchema)
    .query(({ ctx, input }) => auditLogService.history(ctx, input)),
});

import { router } from "./init";
import { attachmentRouter } from "./routers/attachment.router";
import { auditLogRouter } from "./routers/audit-log.router";
import { branchRouter } from "./routers/branch.router";
import { clientRouter } from "./routers/client.router";
import { commentTemplateRouter } from "./routers/comment-template.router";
import { csvExportRouter } from "./routers/csv-export.router";
import { csvImportRouter } from "./routers/csv-import.router";
import { healthRouter } from "./routers/health.router";
import { permissionRouter } from "./routers/permission.router";
import { sourceRouter } from "./routers/source.router";
import { staffRouter } from "./routers/staff.router";
import { userRouter } from "./routers/user.router";

export const appRouter = router({
  attachment: attachmentRouter,
  auditLog: auditLogRouter,
  branch: branchRouter,
  client: clientRouter,
  commentTemplate: commentTemplateRouter,
  csvExport: csvExportRouter,
  csvImport: csvImportRouter,
  health: healthRouter,
  permission: permissionRouter,
  source: sourceRouter,
  staff: staffRouter,
  user: userRouter,
});

/** Imported (type-only) by apps/web for end-to-end type safety. */
export type AppRouter = typeof appRouter;

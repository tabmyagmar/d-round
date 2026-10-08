import { router } from "./init";
import { commentTemplateRouter } from "./routers/comment-template.router";
import { healthRouter } from "./routers/health.router";
import { permissionRouter } from "./routers/permission.router";
import { sourceRouter } from "./routers/source.router";
import { staffRouter } from "./routers/staff.router";
import { userRouter } from "./routers/user.router";

export const appRouter = router({
  commentTemplate: commentTemplateRouter,
  health: healthRouter,
  permission: permissionRouter,
  source: sourceRouter,
  staff: staffRouter,
  user: userRouter,
});

/** Imported (type-only) by apps/web for end-to-end type safety. */
export type AppRouter = typeof appRouter;

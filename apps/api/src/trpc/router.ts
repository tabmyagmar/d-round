import { router } from "./init";
import { healthRouter } from "./routers/health.router";
import { userRouter } from "./routers/user.router";

export const appRouter = router({
  health: healthRouter,
  user: userRouter,
});

/** Imported (type-only) by apps/web for end-to-end type safety. */
export type AppRouter = typeof appRouter;

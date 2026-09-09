import { router } from "./init";
import { healthRouter } from "./routers/health.router";

export const appRouter = router({
  health: healthRouter,
});

/** Imported (type-only) by apps/web for end-to-end type safety. */
export type AppRouter = typeof appRouter;

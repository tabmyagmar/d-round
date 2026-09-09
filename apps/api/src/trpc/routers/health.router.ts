import { publicProcedure, router } from "../init";

export const healthRouter = router({
  /** Liveness of the tRPC transport itself (no dependencies). Used by the web smoke page. */
  ping: publicProcedure.query(({ ctx }) => ({
    ok: true,
    requestId: ctx.requestId,
    time: new Date(),
  })),
});

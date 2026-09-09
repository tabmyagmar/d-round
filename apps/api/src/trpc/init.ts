import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { RequestContext } from "../core/context";
import { toTRPCError } from "../core/error-mapping";
import { isDomainError } from "../core/errors";

/**
 * tRPC wiring. Routers live in ./routers, one per module, and only ever do:
 * zod input → ability check → service call. No business logic here.
 */
const t = initTRPC.context<RequestContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, ctx }) => ({
    ...shape,
    data: { ...shape.data, requestId: ctx?.requestId ?? null },
  }),
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

/** Translates domain errors thrown by services into TRPCErrors and logs failures once. */
const domainErrorMapping = t.middleware(async ({ ctx, path, type, next }) => {
  const result = await next();
  if (result.ok) {
    return result;
  }

  const cause = result.error.cause;
  if (isDomainError(cause)) {
    ctx.logger.warn({ path, type, code: cause.code, err: cause }, "request rejected");
    throw toTRPCError(cause);
  }

  if (result.error.code === "INTERNAL_SERVER_ERROR") {
    ctx.logger.error({ path, type, err: cause ?? result.error }, "request failed");
    // tRPC keeps the original message when it wraps an unknown error; never leak it.
    if (cause !== undefined && !(cause instanceof TRPCError)) {
      throw toTRPCError(cause);
    }
    return result;
  }

  ctx.logger.warn({ path, type, code: result.error.code }, "request rejected");
  return result;
});

export const publicProcedure = t.procedure.use(domainErrorMapping);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

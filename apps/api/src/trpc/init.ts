import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { Action, SubjectName } from "@repo/permissions";

import type { RequestContext } from "../core/context";
import { toTRPCError } from "../core/error-mapping";
import { ForbiddenError, isDomainError } from "../core/errors";
import { recordFailure } from "../modules/audit-log/audit-log.service";

/** What a procedure tells the middleware: `audit: false` exempts a mutation from the audit log. */
export type ProcedureMeta = { audit?: false };

/**
 * tRPC wiring. Routers live in ./routers, one per module, and only ever do:
 * zod input → ability check → service call. No business logic here.
 */
const t = initTRPC
  .context<RequestContext>()
  .meta<ProcedureMeta>()
  .create({
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

/**
 * A failed mutation — refused by `requireAbility`, invalid input, a domain error, a crash — leaves
 * one FAILURE row in the audit log (docs/adr/0015-audit-log.md); a successful write records its own
 * rows inside its transaction. Queries and exempt mutations pass untouched.
 */
const auditFailures = t.middleware(async ({ ctx, path, type, meta, next }) => {
  const result = await next();
  if (!result.ok && type === "mutation" && meta?.audit !== false) {
    const cause = result.error.cause;
    await recordFailure(ctx, path, isDomainError(cause) ? cause.code : result.error.code);
  }
  return result;
});

export const protectedProcedure = publicProcedure
  .use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
  .use(auditFailures);

/**
 * Layer-1 authorization: may this role attempt this kind of action at all? Row-level and
 * stateful decisions stay in the service. Every non-public procedure uses this.
 */
export const requireAbility = (action: Action, subjectName: SubjectName) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.ability.can(action, subjectName)) {
      throw new ForbiddenError(`Not allowed to ${action} ${subjectName}`);
    }
    return next();
  });

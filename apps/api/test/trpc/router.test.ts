import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { Auth } from "@repo/auth";
import { definePrismaAbilityFor } from "@repo/permissions/server";

import type { AuthUser, RequestContext } from "../../src/core/context";
import { NotFoundError } from "../../src/core/errors";
import {
  createCallerFactory,
  protectedProcedure,
  publicProcedure,
  router,
} from "../../src/trpc/init";
import { appRouter } from "../../src/trpc/router";
import { silentLogger } from "../support";

/** Pure wiring tests: hand-built contexts, no database (health and middleware only). */
const contextFor = (user: AuthUser | null = null): RequestContext => ({
  requestId: "req-1",
  logger: silentLogger(),
  headers: new Headers(),
  user,
  ability: definePrismaAbilityFor(user),
  db: {} as RequestContext["db"],
  redis: {} as RequestContext["redis"],
  auth: {} as Auth,
  webOrigin: "http://localhost:3000",
});

const staff: AuthUser = {
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e",
  email: "a@b.c",
  name: "A",
  role: "staff",
  emailVerified: true,
  permissions: [],
};

describe("appRouter.health.ping", () => {
  it("answers with ok, the request id and a Date", async () => {
    const caller = createCallerFactory(appRouter)(contextFor());

    const result = await caller.health.ping();

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("req-1");
    expect(result.time).toBeInstanceOf(Date);
  });
});

describe("procedure middleware", () => {
  const testRouter = router({
    missing: publicProcedure.query(() => {
      throw new NotFoundError("Thing", "t1");
    }),
    exploding: publicProcedure.query(() => {
      throw new Error("db on fire at 10.0.0.5");
    }),
    secret: protectedProcedure.query(({ ctx }) => ctx.user.email),
  });
  const createCaller = createCallerFactory(testRouter);

  it("maps domain errors to the matching tRPC code", async () => {
    await expect(createCaller(contextFor()).missing()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Thing t1 not found",
    });
  });

  it("does not leak unknown error messages", async () => {
    const error = await createCaller(contextFor())
      .exploding()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
    expect((error as TRPCError).message).not.toContain("10.0.0.5");
  });

  it("rejects unauthenticated calls to protected procedures and passes the typed user", async () => {
    await expect(createCaller(contextFor()).secret()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(createCaller(contextFor(staff)).secret()).resolves.toBe("a@b.c");
  });
});

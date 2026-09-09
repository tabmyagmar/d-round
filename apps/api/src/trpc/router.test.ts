import { Writable } from "node:stream";

import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { createLogger } from "@repo/logger";

import type { RequestContext } from "../core/context";
import { NotFoundError } from "../core/errors";

import { createCallerFactory, protectedProcedure, publicProcedure, router } from "./init";
import { appRouter } from "./router";

const silentLogger = () =>
  createLogger(
    { name: "test", level: "silent" },
    new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  );

const contextFor = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  requestId: "req-1",
  logger: silentLogger(),
  user: null,
  ability: null,
  db: {} as RequestContext["db"],
  redis: {} as RequestContext["redis"],
  ...overrides,
});

describe("appRouter.health.ping", () => {
  it("answers with ok, the request id and a Date", async () => {
    const caller = createCallerFactory(appRouter)(contextFor({ requestId: "req-ping" }));

    const result = await caller.health.ping();

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("req-ping");
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

    const user = { id: "u1", email: "a@b.c", role: "member" };
    await expect(createCaller(contextFor({ user })).secret()).resolves.toBe("a@b.c");
  });
});

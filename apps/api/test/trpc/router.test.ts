import { Writable } from "node:stream";

import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { Auth } from "@repo/auth";
import { childLogger, createDiscordAlertStream, createLogger } from "@repo/logger";
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

const am: AuthUser = {
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e",
  email: "a@b.c",
  name: "A",
  role: "am",
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
    await expect(createCaller(contextFor(am)).secret()).resolves.toBe("a@b.c");
  });

  it("alerts Discord once for an unknown error and never for a domain error", async () => {
    const bodies: string[] = [];
    const alerts = createDiscordAlertStream({
      webhookUrl: "https://discord.test/api/webhooks/1/secret",
      fetch: (_url, init) => {
        bodies.push(init?.body as string);
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    const logger = createLogger(
      { name: "api", alerts },
      new Writable({
        write: (_chunk, _encoding, callback) => {
          callback();
        },
      }),
    );
    const caller = createCaller({
      ...contextFor(),
      logger: childLogger(logger, { requestId: "req-1" }),
    });

    await expect(caller.missing()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.exploding()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await alerts.flush();

    expect(bodies).toHaveLength(1);
    const [embed] = (
      JSON.parse(bodies[0]!) as {
        embeds: { title: string; description: string; fields: { name: string; value: string }[] }[];
      }
    ).embeds;
    expect(embed?.title).toBe("🟠 request failed");
    expect(embed?.description).toContain("**Error:** db on fire at 10.0.0.5");
    expect(embed?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "path", value: "`exploding`" }),
        expect.objectContaining({ name: "requestId", value: "`req-1`" }),
      ]),
    );
  });
});

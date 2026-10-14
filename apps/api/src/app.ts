import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { RateLimiterAbstract } from "rate-limiter-flexible";

import { CLIENT_IP_HEADER } from "@repo/auth";

import { REQUEST_ID_HEADER, buildRequestContext } from "./core/context";
import type { ContextDeps } from "./core/context";
import { createHealthProbes } from "./health/probes";
import { QUEUE_BOARD_PATH, createQueueBoard } from "./lib/queue-board";
import {
  PASSWORD_RESET_RATE_LIMIT,
  SIGN_IN_RATE_LIMIT,
  clientIp,
  createRateLimiter,
  rateLimit,
} from "./middleware/rate-limit";
import { requestLogger } from "./middleware/request-logger";
import type { AppVariables } from "./middleware/request-logger";
import { checkHealth } from "./modules/health/health.service";
import type { HealthProbes } from "./modules/health/health.service";
import { appRouter } from "./trpc/router";

export type AppDeps = ContextDeps & {
  /** Override for tests; defaults to real Postgres + Redis probes. */
  probes?: HealthProbes;
  /** Override for tests; defaults to SIGN_IN_RATE_LIMIT on Redis. */
  signInRateLimiter?: RateLimiterAbstract;
  /** Override for tests; defaults to PASSWORD_RESET_RATE_LIMIT on Redis. */
  passwordResetRateLimiter?: RateLimiterAbstract;
};

export type App = Hono<{ Variables: AppVariables }>;

/**
 * Better Auth's bodies are a few fields; a larger one is refused before Better Auth or its audit
 * hooks read it (ADR 0015).
 */
const AUTH_BODY_MAX_BYTES = 64 * 1024;

/**
 * The request Better Auth gets: the client's address (`clientIp`, the rate limiter's rule) and the
 * request id in headers the API sets itself, overwriting whatever the client sent — Better Auth's
 * `sessions` rows and the audit log read them (ADR 0015).
 */
const authRequestOf = (c: Context<{ Variables: AppVariables }>): Request => {
  const headers = new Headers(c.req.raw.headers);
  headers.set(CLIENT_IP_HEADER, clientIp(c));
  headers.set(REQUEST_ID_HEADER, c.get("requestId"));
  return new Request(c.req.raw, { headers });
};

/**
 * HTTP composition root. Transports are mounted side by side: /api/auth (Better Auth) and
 * /trpc now, /graphql and /api/v1 later — each one only wraps buildRequestContext and the
 * shared error mapping.
 */
export const createApp = (deps: AppDeps): App => {
  const app = new Hono<{ Variables: AppVariables }>();
  const probes = deps.probes ?? createHealthProbes(deps);
  const signInLimiter = deps.signInRateLimiter ?? createRateLimiter(deps.redis, SIGN_IN_RATE_LIMIT);
  const passwordResetLimiter =
    deps.passwordResetRateLimiter ?? createRateLimiter(deps.redis, PASSWORD_RESET_RATE_LIMIT);

  app.use(requestId({ headerName: REQUEST_ID_HEADER }));
  app.use(requestLogger(deps.logger));

  const browserCors = cors({
    origin: deps.webOrigin,
    credentials: true,
    allowHeaders: ["content-type", "authorization", REQUEST_ID_HEADER],
  });
  app.use("/trpc/*", browserCors);
  app.use("/api/auth/*", browserCors);

  app.get("/health", async (c) => {
    const report = await checkHealth(probes);
    return c.json(report, report.status === "ok" ? 200 : 503);
  });

  // Better Auth owns everything below /api/auth; sign-in attempts and password reset requests
  // (they send mail) are rate limited per IP.
  app.use(
    "/api/auth/*",
    bodyLimit({
      maxSize: AUTH_BODY_MAX_BYTES,
      onError: (c) => c.json({ error: "Payload too large", requestId: c.get("requestId") }, 413),
    }),
  );
  app.use("/api/auth/sign-in/*", rateLimit(signInLimiter));
  app.use("/api/auth/request-password-reset", rateLimit(passwordResetLimiter));
  app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(authRequestOf(c)));

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) =>
        buildRequestContext(
          { headers: c.req.raw.headers, requestId: c.get("requestId"), ipAddress: clientIp(c) },
          deps,
        ),
    }),
  );

  // The bull-board dashboard, opened in the browser by a super_admin (ADR 0014).
  app.route(QUEUE_BOARD_PATH, createQueueBoard(deps));

  app.notFound((c) => c.json({ error: "Not found", requestId: c.get("requestId") }, 404));

  app.onError((error, c) => {
    c.get("logger").error({ err: error }, "unhandled error");
    return c.json({ error: "Internal server error", requestId: c.get("requestId") }, 500);
  });

  return app;
};

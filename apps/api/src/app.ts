import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { RateLimiterAbstract } from "rate-limiter-flexible";

import { REQUEST_ID_HEADER, buildRequestContext } from "./core/context";
import type { ContextDeps } from "./core/context";
import { createHealthProbes } from "./health/probes";
import {
  PASSWORD_RESET_RATE_LIMIT,
  SIGN_IN_RATE_LIMIT,
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
  app.use("/api/auth/sign-in/*", rateLimit(signInLimiter));
  app.use("/api/auth/request-password-reset", rateLimit(passwordResetLimiter));
  app.on(["GET", "POST"], "/api/auth/*", (c) => deps.auth.handler(c.req.raw));

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) =>
        buildRequestContext({ headers: c.req.raw.headers, requestId: c.get("requestId") }, deps),
    }),
  );

  app.notFound((c) => c.json({ error: "Not found", requestId: c.get("requestId") }, 404));

  app.onError((error, c) => {
    c.get("logger").error({ err: error }, "unhandled error");
    return c.json({ error: "Internal server error", requestId: c.get("requestId") }, 500);
  });

  return app;
};

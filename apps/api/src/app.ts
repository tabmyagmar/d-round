import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { REQUEST_ID_HEADER, buildRequestContext } from "./core/context";
import type { ContextDeps } from "./core/context";
import { createHealthProbes } from "./health/probes";
import { requestLogger } from "./middleware/request-logger";
import type { AppVariables } from "./middleware/request-logger";
import { checkHealth } from "./modules/health/health.service";
import type { HealthProbes } from "./modules/health/health.service";
import { appRouter } from "./trpc/router";

export type AppDeps = ContextDeps & {
  /** Browser origin allowed to call the API with cookies. */
  webOrigin: string;
  /** Override for tests; defaults to real Postgres + Redis probes. */
  probes?: HealthProbes;
};

export type App = Hono<{ Variables: AppVariables }>;

/**
 * HTTP composition root. Transports are mounted side by side: /trpc now, /graphql and
 * /api/v1 later — each one only wraps buildRequestContext and the shared error mapping.
 */
export const createApp = (deps: AppDeps): App => {
  const app = new Hono<{ Variables: AppVariables }>();
  const probes = deps.probes ?? createHealthProbes(deps);

  app.use(requestId({ headerName: REQUEST_ID_HEADER }));
  app.use(requestLogger(deps.logger));
  app.use(
    "/trpc/*",
    cors({
      origin: deps.webOrigin,
      credentials: true,
      allowHeaders: ["content-type", REQUEST_ID_HEADER],
    }),
  );

  app.get("/health", async (c) => {
    const report = await checkHealth(probes);
    return c.json(report, report.status === "ok" ? 200 : 503);
  });

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

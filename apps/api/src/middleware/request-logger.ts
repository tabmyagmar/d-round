import type { MiddlewareHandler } from "hono";

import { childLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";

export type AppVariables = {
  requestId: string;
  logger: Logger;
};

/**
 * Attaches a request-scoped child logger (with requestId) to the Hono context and writes
 * one access-log line per request. Must run after hono/request-id.
 */
export const requestLogger =
  (baseLogger: Logger): MiddlewareHandler<{ Variables: AppVariables }> =>
  async (c, next) => {
    const logger = childLogger(baseLogger, { requestId: c.get("requestId") });
    c.set("logger", logger);
    const startedAt = performance.now();

    await next();

    const durationMs = Math.round(performance.now() - startedAt);
    const line = { method: c.req.method, path: c.req.path, status: c.res.status, durationMs };
    if (c.res.status >= 500) {
      logger.error(line, "request completed");
    } else {
      logger.info(line, "request completed");
    }
  };

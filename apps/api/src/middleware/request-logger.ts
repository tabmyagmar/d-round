import type { MiddlewareHandler } from "hono";

import { REDACT_CENSOR, childLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";

export type AppVariables = {
  requestId: string;
  logger: Logger;
};

/**
 * Better Auth mails `/api/auth/reset-password/<token>`; whoever holds the token can set that user's
 * password for an hour, so it never reaches a log line or an alert.
 */
const RESET_PASSWORD_TOKEN = /^(\/api\/auth\/reset-password\/)[^/]+/;

const loggablePath = (path: string): string =>
  path.replace(RESET_PASSWORD_TOKEN, `$1${REDACT_CENSOR}`);

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
    const line = {
      method: c.req.method,
      path: loggablePath(c.req.path),
      status: c.res.status,
      durationMs,
    };
    if (c.res.status >= 500) {
      logger.error(line, "request completed");
    } else {
      logger.info(line, "request completed");
    }
  };

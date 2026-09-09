import { serve } from "@hono/node-server";

import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createLogger } from "@repo/logger";
import { createRedisConnection } from "@repo/queue";

import { createApp } from "./app";
import { loadApiEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";

const env = loadApiEnv();
const logger = createLogger({
  name: "api",
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
  base: { env: env.NODE_ENV },
});

const db = getPrismaClient({ connectionString: env.DATABASE_URL });
const redis = createRedisConnection(env.REDIS_URL, { connectionName: "api" });
redis.on("error", (error) => {
  logger.error({ err: error }, "redis connection error");
});

const app = createApp({ logger, db, redis, webOrigin: env.WEB_ORIGIN });

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port, webOrigin: env.WEB_ORIGIN }, "api listening");
});

registerGracefulShutdown({
  logger,
  steps: [
    {
      name: "http server",
      run: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }),
    },
    { name: "redis", run: () => redis.quit() },
    { name: "database", run: () => disconnectPrismaClient() },
  ],
});

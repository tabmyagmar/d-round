import { serve } from "@hono/node-server";

import { createAuth } from "@repo/auth";
import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createDiscordAlertStream, createLogger } from "@repo/logger";
import { createEmailQueue, createRedisConnection } from "@repo/queue";

import { createApp } from "./app";
import { loadApiEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";
import { createAuthEmailSenders } from "./modules/email/auth-emails";

const env = loadApiEnv();
// Error and fatal lines also go to Discord when a webhook is set (docs/adr/0010-alerts.md).
const alerts = env.DISCORD_ALERT_WEBHOOK_URL
  ? createDiscordAlertStream({ webhookUrl: env.DISCORD_ALERT_WEBHOOK_URL })
  : undefined;
const logger = createLogger({
  name: "api",
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
  base: { env: env.NODE_ENV },
  ...(alerts ? { alerts } : {}),
});

const db = getPrismaClient({ connectionString: env.DATABASE_URL });
const redis = createRedisConnection(env.REDIS_URL, { connectionName: "api" });
redis.on("error", (error) => {
  logger.error({ err: error }, "redis connection error");
});
const emailQueue = createEmailQueue(redis);

const auth = createAuth({
  prisma: db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  ...(env.COOKIE_DOMAIN ? { cookieDomain: env.COOKIE_DOMAIN } : {}),
  // Outbox: row inside a transaction, job after commit; the worker sends the mail.
  ...createAuthEmailSenders({ db, emailQueue, logger }),
});

const app = createApp({ logger, db, redis, auth, webOrigin: env.WEB_ORIGIN });

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port, webOrigin: env.WEB_ORIGIN, apiUrl: env.API_URL }, "api listening");
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
    { name: "email queue", run: () => emailQueue.close() },
    { name: "redis", run: () => redis.quit() },
    { name: "database", run: () => disconnectPrismaClient() },
    // Last, so the failure of a step above still reaches Discord.
    { name: "alerts", run: () => alerts?.flush() },
  ],
});

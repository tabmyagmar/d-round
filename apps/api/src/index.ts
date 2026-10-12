import { serve } from "@hono/node-server";

import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createDiscordAlertStream, createLogger } from "@repo/logger";
import { createAttachmentDeleteQueue, createEmailQueue, createRedisConnection } from "@repo/queue";
import { createGcsStorage } from "@repo/storage";

import { createApp } from "./app";
import { loadApiEnv } from "./env";
import { createAppAuth } from "./jobs/app-auth";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";

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
// Attachments: signing is local; head and delete call the bucket (ADR 0012).
const storage = createGcsStorage({ bucket: env.GCS_BUCKET, keyFile: env.GCS_KEY_FILE });
// Uploads into a wrong bucket would fail one by one; refuse to start instead, through the logger
// so the failure reaches Discord too (docs/adr/0010-alerts.md).
try {
  await storage.ready();
} catch (error) {
  logger.fatal({ err: error }, "api failed to start");
  await alerts?.flush();
  process.exit(1);
}
const attachmentDeleteQueue = createAttachmentDeleteQueue(redis);

const auth = createAppAuth({
  db,
  emailQueue,
  logger,
  secret: env.BETTER_AUTH_SECRET,
  apiUrl: env.API_URL,
  webOrigin: env.WEB_ORIGIN,
  cookieDomain: env.COOKIE_DOMAIN,
});

const app = createApp({
  logger,
  db,
  redis,
  auth,
  webOrigin: env.WEB_ORIGIN,
  storage,
  attachmentDeleteQueue,
});

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
    { name: "attachment delete queue", run: () => attachmentDeleteQueue.close() },
    { name: "redis", run: () => redis.quit() },
    { name: "database", run: () => disconnectPrismaClient() },
    // Last, so the failure of a step above still reaches Discord.
    { name: "alerts", run: () => alerts?.flush() },
  ],
});

import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createDiscordAlertStream, createLogger } from "@repo/logger";
import { createEmailQueue, createRedisConnection, waitForRedis } from "@repo/queue";

import { loadWorkerEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";
import { mailDisplayName } from "./mail/mail-from";
import { createSmtpMailProvider } from "./mail/smtp-mail-provider";
import { createEmailWorker } from "./processors/email.processor";
import {
  createOutboxSweeperQueue,
  createOutboxSweeperWorker,
  registerOutboxSweeper,
} from "./schedulers/outbox-sweeper";

/**
 * Worker process bootstrap. Every BullMQ consumer in the system is started from here and
 * nowhere else: the email processor and the outbox sweeper.
 */
const env = loadWorkerEnv();
// Error and fatal lines also go to Discord when a webhook is set (docs/adr/0010-alerts.md).
const alerts = env.DISCORD_ALERT_WEBHOOK_URL
  ? createDiscordAlertStream({ webhookUrl: env.DISCORD_ALERT_WEBHOOK_URL })
  : undefined;
const logger = createLogger({
  name: "worker",
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
  base: { env: env.NODE_ENV },
  ...(alerts ? { alerts } : {}),
});

const db = getPrismaClient({ connectionString: env.DATABASE_URL, maxConnections: 5 });
const connection = createRedisConnection(env.REDIS_URL, { connectionName: "worker" });
connection.on("error", (error) => {
  logger.error({ err: error }, "redis connection error");
});

const mailProvider = createSmtpMailProvider({ smtpUrl: env.MAIL_SMTP_URL, from: env.MAIL_FROM });
const brand = { appName: mailDisplayName(env.MAIL_FROM) };
const emailQueue = createEmailQueue(connection);
const sweeperQueue = createOutboxSweeperQueue(connection);

// Registered in src/processors/*.processor.ts and src/schedulers/* and listed here.
const workers: { close: () => Promise<void> }[] = [
  createEmailWorker({ connection, db, provider: mailProvider, logger, brand }),
  createOutboxSweeperWorker({ connection, db, emailQueue, logger }),
];

const shutdown = registerGracefulShutdown({
  logger,
  steps: [
    { name: "workers", run: () => Promise.all(workers.map((worker) => worker.close())) },
    { name: "queues", run: () => Promise.all([emailQueue.close(), sweeperQueue.close()]) },
    { name: "mail provider", run: () => mailProvider.close?.() },
    { name: "redis", run: () => connection.quit() },
    { name: "database", run: () => disconnectPrismaClient() },
    // Last, so the failure of a step above still reaches Discord.
    { name: "alerts", run: () => alerts?.flush() },
  ],
});

try {
  await waitForRedis(connection);
  await registerOutboxSweeper(sweeperQueue);
  logger.info({ workers: workers.length }, "worker ready");
} catch (error) {
  logger.fatal({ err: error }, "worker failed to start");
  await shutdown("startup failure", 1);
}

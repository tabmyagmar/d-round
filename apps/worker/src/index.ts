import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createDiscordAlertStream, createLogger } from "@repo/logger";
import {
  createAttachmentDeleteQueue,
  createEmailQueue,
  createRedisConnection,
  waitForRedis,
} from "@repo/queue";
import { createGcsStorage } from "@repo/storage";

import { loadWorkerEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";
import { mailDisplayName } from "./mail/mail-from";
import { createSmtpMailProvider } from "./mail/smtp-mail-provider";
import { createAttachmentDeleteWorker } from "./processors/attachment-delete.processor";
import { createEmailWorker } from "./processors/email.processor";
import {
  createAttachmentSweeperQueue,
  createAttachmentSweeperWorker,
  registerAttachmentSweeper,
} from "./schedulers/attachment-sweeper";
import {
  createOutboxSweeperQueue,
  createOutboxSweeperWorker,
  registerOutboxSweeper,
} from "./schedulers/outbox-sweeper";

/**
 * Worker process bootstrap. Every BullMQ consumer in the system is started from here and
 * nowhere else: the email processor and the outbox sweeper, the attachment delete processor and
 * the attachment sweeper.
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
// Attachments: objects are deleted after the row says so (docs/adr/0012-attachments.md).
const storage = createGcsStorage({ bucket: env.GCS_BUCKET, keyFile: env.GCS_KEY_FILE });
const attachmentDeleteQueue = createAttachmentDeleteQueue(connection);
const attachmentSweeperQueue = createAttachmentSweeperQueue(connection);

// Registered in src/processors/*.processor.ts and src/schedulers/* and listed here.
const workers: { close: () => Promise<void> }[] = [
  createEmailWorker({ connection, db, provider: mailProvider, logger, brand }),
  createOutboxSweeperWorker({ connection, db, emailQueue, logger }),
  createAttachmentDeleteWorker({ connection, db, storage, logger }),
  createAttachmentSweeperWorker({ connection, db, attachmentDeleteQueue, logger }),
];

const shutdown = registerGracefulShutdown({
  logger,
  steps: [
    { name: "workers", run: () => Promise.all(workers.map((worker) => worker.close())) },
    {
      name: "queues",
      run: () =>
        Promise.all([
          emailQueue.close(),
          sweeperQueue.close(),
          attachmentDeleteQueue.close(),
          attachmentSweeperQueue.close(),
        ]),
    },
    { name: "mail provider", run: () => mailProvider.close?.() },
    { name: "redis", run: () => connection.quit() },
    { name: "database", run: () => disconnectPrismaClient() },
    // Last, so the failure of a step above still reaches Discord.
    { name: "alerts", run: () => alerts?.flush() },
  ],
});

try {
  await waitForRedis(connection);
  // A wrong bucket would make every delete a 404 that counts as done (docs/attachments.md).
  await storage.ready();
  await registerOutboxSweeper(sweeperQueue);
  await registerAttachmentSweeper(attachmentSweeperQueue);
  logger.info({ workers: workers.length }, "worker ready");
} catch (error) {
  logger.fatal({ err: error }, "worker failed to start");
  await shutdown("startup failure", 1);
}

import { disconnectPrismaClient, getPrismaClient } from "@repo/database";
import { createLogger } from "@repo/logger";
import { createEmailQueue, createRedisConnection, waitForRedis } from "@repo/queue";

import { loadWorkerEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";
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
const logger = createLogger({
  name: "worker",
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
  base: { env: env.NODE_ENV },
});

const db = getPrismaClient({ connectionString: env.DATABASE_URL, maxConnections: 5 });
const connection = createRedisConnection(env.REDIS_URL, { connectionName: "worker" });
connection.on("error", (error) => {
  logger.error({ err: error }, "redis connection error");
});

const mailProvider = createSmtpMailProvider({ smtpUrl: env.MAIL_SMTP_URL, from: env.MAIL_FROM });
const emailQueue = createEmailQueue(connection);
const sweeperQueue = createOutboxSweeperQueue(connection);

// Registered in src/processors/*.processor.ts and src/schedulers/* and listed here.
const workers: { close: () => Promise<void> }[] = [
  createEmailWorker({ connection, db, provider: mailProvider, logger }),
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
  ],
});

try {
  await waitForRedis(connection);
  await registerOutboxSweeper(sweeperQueue);
  logger.info({ workers: workers.length }, "worker ready");
} catch (error) {
  logger.fatal({ err: error }, "worker failed to start");
  await shutdown("startup failure");
}

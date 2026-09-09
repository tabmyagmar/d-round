import { createLogger } from "@repo/logger";
import { createRedisConnection, waitForRedis } from "@repo/queue";
import type { TypedWorker } from "@repo/queue";

import { loadWorkerEnv } from "./env";
import { registerGracefulShutdown } from "./lib/graceful-shutdown";

/**
 * Worker process bootstrap. Every BullMQ consumer in the system is started from here and
 * nowhere else. Phase 0 starts zero workers; Phase 1 registers the email processor.
 */
const env = loadWorkerEnv();
const logger = createLogger({
  name: "worker",
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
  base: { env: env.NODE_ENV },
});

const connection = createRedisConnection(env.REDIS_URL, { connectionName: "worker" });
connection.on("error", (error) => {
  logger.error({ err: error }, "redis connection error");
});

// Registered in src/processors/*.processor.ts and listed here.
const workers: TypedWorker<unknown, unknown>[] = [];

const shutdown = registerGracefulShutdown({
  logger,
  steps: [
    { name: "workers", run: () => Promise.all(workers.map((worker) => worker.close())) },
    { name: "redis", run: () => connection.quit() },
  ],
});

try {
  await waitForRedis(connection);
  logger.info({ workers: workers.length }, "worker ready");
} catch (error) {
  logger.fatal({ err: error }, "could not connect to redis");
  await shutdown("startup failure");
}

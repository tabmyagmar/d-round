import { config as loadDotenv } from "dotenv";

import { createEnv, logLevelSchema, nodeEnvSchema, urlSchema } from "@repo/validation/env";
import type { EnvSource } from "@repo/validation/env";

export const workerEnvShape = {
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  DATABASE_URL: urlSchema,
  REDIS_URL: urlSchema,
};

export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

/** Same contract as apps/api: dotenv files (local, then root), real env wins. */
export const loadWorkerEnv = (source?: EnvSource) => {
  if (!source) {
    loadDotenv({ path: [".env", "../../.env"], quiet: true });
  }
  return createEnv(workerEnvShape, source);
};

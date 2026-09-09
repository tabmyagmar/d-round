import { config as loadDotenv } from "dotenv";

import { z } from "@repo/validation";
import { createEnv, logLevelSchema, nodeEnvSchema, urlSchema } from "@repo/validation/env";
import type { EnvSource } from "@repo/validation/env";

export const workerEnvShape = {
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  DATABASE_URL: urlSchema,
  REDIS_URL: urlSchema,
  /** smtp://host:port — Mailpit in development (docker-compose). */
  MAIL_SMTP_URL: urlSchema,
  /** Sender shown to recipients, e.g. `d-round <no-reply@example.com>`. */
  MAIL_FROM: z.string().min(3),
};

export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

/** Same contract as apps/api: dotenv files (local, then root), real env wins. */
export const loadWorkerEnv = (source?: EnvSource) => {
  if (!source) {
    loadDotenv({ path: [".env", "../../.env"], quiet: true });
  }
  return createEnv(workerEnvShape, source);
};

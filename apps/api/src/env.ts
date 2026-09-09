import { config as loadDotenv } from "dotenv";

import {
  createEnv,
  logLevelSchema,
  nodeEnvSchema,
  portSchema,
  urlSchema,
} from "@repo/validation/env";
import type { EnvSource } from "@repo/validation/env";

export const apiEnvShape = {
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  API_PORT: portSchema.default(4000),
  DATABASE_URL: urlSchema,
  REDIS_URL: urlSchema,
  /** Browser origin allowed to call the API with credentials. */
  WEB_ORIGIN: urlSchema.default("http://localhost:3000"),
};

export type ApiEnv = ReturnType<typeof loadApiEnv>;

/**
 * Loads `.env` files (app-local first, then the monorepo root) and validates the result.
 * Real environment variables always win over files. Called exactly once in index.ts.
 */
export const loadApiEnv = (source?: EnvSource) => {
  if (!source) {
    loadDotenv({ path: [".env", "../../.env"], quiet: true });
  }
  return createEnv(apiEnvShape, source);
};

import { config as loadDotenv } from "dotenv";

import { z } from "@repo/validation";
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
  /** Public origin of the API; Better Auth sets cookies for this host. */
  API_URL: urlSchema.default("http://localhost:4000"),
  DATABASE_URL: urlSchema,
  REDIS_URL: urlSchema,
  /** Browser origin allowed to call the API with credentials. */
  WEB_ORIGIN: urlSchema.default("http://localhost:3000"),
  /** Signs sessions and tokens. Generate with `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Parent domain for shared cookies in production (see docs/adr/0002-auth.md). */
  COOKIE_DOMAIN: z.string().min(1).optional(),
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

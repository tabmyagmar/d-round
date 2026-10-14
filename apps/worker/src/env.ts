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
  /** Sender shown to recipients, e.g. `My App <no-reply@example.com>`; the display name is the brand. */
  MAIL_FROM: z.string().min(3),
  /** Bucket for attachments (docs/adr/0012-attachments.md), e.g. `d-round-dev`. */
  GCS_BUCKET: z.string().min(3),
  /** Service-account key (JSON) outside the repository; read once at start-up. */
  GCS_KEY_FILE: z.string().min(1),
  /**
   * Better Auth as the API runs it: a CSV import invites users and mails their links
   * (docs/adr/0013-csv-import.md). The same values as the API's.
   */
  BETTER_AUTH_SECRET: z.string().min(32),
  API_URL: urlSchema.default("http://localhost:4000"),
  WEB_ORIGIN: urlSchema.default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  /**
   * Discord webhook for error and fatal log lines; https only, since the URL is a secret. Unset =
   * no alerts (docs/adr/0010-alerts.md).
   */
  DISCORD_ALERT_WEBHOOK_URL: z.url({ protocol: /^https$/ }).optional(),
};

export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

/** Same contract as apps/api: dotenv files (local, then root), real env wins. */
export const loadWorkerEnv = (source?: EnvSource) => {
  if (!source) {
    loadDotenv({ path: [".env", "../../.env"], quiet: true });
  }
  return createEnv(workerEnvShape, source);
};

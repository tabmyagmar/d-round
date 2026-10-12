import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadWorkerEnv } from "../src/env";

const complete = {
  DATABASE_URL: "postgresql://localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  MAIL_SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Acme <no-reply@example.com>",
  GCS_BUCKET: "d-round-test",
  GCS_KEY_FILE: "/secrets/gcs-key.json",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
};

describe("loadWorkerEnv", () => {
  it("accepts a complete environment and applies defaults", () => {
    const env = loadWorkerEnv(complete);

    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.MAIL_SMTP_URL).toBe("smtp://localhost:1025");
    expect(env.API_URL).toBe("http://localhost:4000");
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
  });

  it("refuses to start without REDIS_URL, the mail, the bucket or the auth secret", () => {
    const { REDIS_URL: _redis, ...withoutRedis } = complete;
    expect(() => loadWorkerEnv(withoutRedis)).toThrow(EnvValidationError);

    const { MAIL_SMTP_URL: _smtp, ...withoutSmtp } = complete;
    expect(() => loadWorkerEnv(withoutSmtp)).toThrow(EnvValidationError);

    const { GCS_KEY_FILE: _keyFile, ...withoutKeyFile } = complete;
    expect(() => loadWorkerEnv(withoutKeyFile)).toThrow(EnvValidationError);

    // A CSV import invites users through Better Auth (docs/adr/0013-csv-import.md).
    const { BETTER_AUTH_SECRET: _secret, ...withoutSecret } = complete;
    expect(() => loadWorkerEnv(withoutSecret)).toThrow(EnvValidationError);
  });

  it("starts without a Discord webhook and refuses one that is not an https URL", () => {
    expect(loadWorkerEnv(complete).DISCORD_ALERT_WEBHOOK_URL).toBeUndefined();
    expect(() => loadWorkerEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: "not a url" })).toThrow(
      EnvValidationError,
    );
    expect(() =>
      loadWorkerEnv({
        ...complete,
        DISCORD_ALERT_WEBHOOK_URL: "http://discord.com/api/webhooks/1/t",
      }),
    ).toThrow(EnvValidationError);
  });
});

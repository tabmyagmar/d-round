import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadApiEnv } from "../src/env";

const complete = {
  DATABASE_URL: "postgresql://localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
  GCS_BUCKET: "d-round-test",
  GCS_KEY_FILE: "/secrets/gcs-key.json",
};

describe("loadApiEnv", () => {
  it("refuses to start without the attachment bucket settings", () => {
    const { GCS_BUCKET: _bucket, ...withoutBucket } = complete;
    expect(() => loadApiEnv(withoutBucket)).toThrow(EnvValidationError);

    const { GCS_KEY_FILE: _keyFile, ...withoutKeyFile } = complete;
    expect(() => loadApiEnv(withoutKeyFile)).toThrow(EnvValidationError);
  });

  it("starts without a Discord webhook: alerts are optional", () => {
    expect(loadApiEnv(complete).DISCORD_ALERT_WEBHOOK_URL).toBeUndefined();
  });

  it("takes a Discord webhook URL", () => {
    const url = "https://discord.com/api/webhooks/1/token";

    expect(
      loadApiEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: url }).DISCORD_ALERT_WEBHOOK_URL,
    ).toBe(url);
  });

  it("refuses to start with a webhook that is not an https URL", () => {
    expect(() => loadApiEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: "not a url" })).toThrow(
      EnvValidationError,
    );
    expect(() =>
      loadApiEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: "http://discord.com/api/webhooks/1/t" }),
    ).toThrow(EnvValidationError);
  });
});

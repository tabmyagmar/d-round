import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadApiEnv } from "../src/env";

const complete = {
  DATABASE_URL: "postgresql://localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("loadApiEnv", () => {
  it("starts without a Discord webhook: alerts are optional", () => {
    expect(loadApiEnv(complete).DISCORD_ALERT_WEBHOOK_URL).toBeUndefined();
  });

  it("takes a Discord webhook URL", () => {
    const url = "https://discord.com/api/webhooks/1/token";

    expect(
      loadApiEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: url }).DISCORD_ALERT_WEBHOOK_URL,
    ).toBe(url);
  });

  it("refuses to start with a webhook value that is not a URL", () => {
    expect(() => loadApiEnv({ ...complete, DISCORD_ALERT_WEBHOOK_URL: "not a url" })).toThrow(
      EnvValidationError,
    );
  });
});

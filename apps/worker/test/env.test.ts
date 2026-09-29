import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadWorkerEnv } from "../src/env";

const complete = {
  DATABASE_URL: "postgresql://localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  MAIL_SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Acme <no-reply@example.com>",
};

describe("loadWorkerEnv", () => {
  it("accepts a complete environment and applies defaults", () => {
    const env = loadWorkerEnv(complete);

    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.MAIL_SMTP_URL).toBe("smtp://localhost:1025");
  });

  it("refuses to start without REDIS_URL or the mail settings", () => {
    const { REDIS_URL: _redis, ...withoutRedis } = complete;
    expect(() => loadWorkerEnv(withoutRedis)).toThrow(EnvValidationError);

    const { MAIL_SMTP_URL: _smtp, ...withoutSmtp } = complete;
    expect(() => loadWorkerEnv(withoutSmtp)).toThrow(EnvValidationError);
  });
});

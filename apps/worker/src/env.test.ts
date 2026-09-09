import { describe, expect, it } from "vitest";

import { EnvValidationError } from "@repo/validation/env";

import { loadWorkerEnv } from "./env";

describe("loadWorkerEnv", () => {
  it("accepts a complete environment and applies defaults", () => {
    const env = loadWorkerEnv({
      DATABASE_URL: "postgresql://localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("refuses to start without REDIS_URL", () => {
    expect(() => loadWorkerEnv({ DATABASE_URL: "postgresql://localhost:5432/db" })).toThrow(
      EnvValidationError,
    );
  });
});

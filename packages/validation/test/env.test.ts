import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  EnvValidationError,
  booleanStringSchema,
  createEnv,
  logLevelSchema,
  nodeEnvSchema,
  portSchema,
} from "../src/env";

const shape = {
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  API_PORT: portSchema,
  DATABASE_URL: z.url(),
  FEATURE_FLAG: booleanStringSchema.default(false),
};

describe("createEnv", () => {
  it("parses, coerces and applies defaults", () => {
    const env = createEnv(shape, {
      API_PORT: "4000",
      DATABASE_URL: "postgresql://localhost:5432/db",
      UNRELATED: "ignored",
    });

    expect(env).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      API_PORT: 4000,
      DATABASE_URL: "postgresql://localhost:5432/db",
      FEATURE_FLAG: false,
    });
  });

  it("lists every invalid variable in one error", () => {
    expect(() => createEnv(shape, { API_PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(
      EnvValidationError,
    );

    try {
      createEnv(shape, { API_PORT: "99999", LOG_LEVEL: "loud" });
    } catch (error) {
      const envError = error as EnvValidationError;
      expect(envError.issues.some((issue) => issue.startsWith("API_PORT:"))).toBe(true);
      expect(envError.issues.some((issue) => issue.startsWith("LOG_LEVEL:"))).toBe(true);
      expect(envError.issues.some((issue) => issue.startsWith("DATABASE_URL:"))).toBe(true);
      expect(envError.message).toContain("Invalid environment variables");
    }
  });

  it("parses boolean strings", () => {
    const env = createEnv({ FLAG: booleanStringSchema }, { FLAG: "1" });
    expect(env.FLAG).toBe(true);
  });
});

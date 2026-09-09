import { z } from "zod";

/**
 * Environment validation. Every app builds its env object exactly once at startup with
 * `createEnv(...)`; nothing else reads process.env. A misconfigured process must crash
 * immediately with a readable list of problems instead of failing later at runtime.
 */

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment variables:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const logLevelSchema = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  .default("info");

export const portSchema = z.coerce.number().int().min(1).max(65535);

export const urlSchema = z.url();

/** Booleans arrive as strings ("true"/"1"/"false"/"0"). */
export const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export type EnvSource = Record<string, string | undefined>;

export const createEnv = <TShape extends z.ZodRawShape>(
  shape: TShape,
  source: EnvSource = process.env,
): z.output<z.ZodObject<TShape>> => {
  const result = z.object(shape).safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  return result.data;
};

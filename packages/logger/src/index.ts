import { pino } from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";

export type { Logger };

/**
 * Keys that must never reach a log line, wherever they appear in the payload.
 * Redaction is configured here once so every app inherits it — do not create pino
 * instances outside this package.
 */
export const REDACT_PATHS: readonly string[] = [
  "password",
  "*.password",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

export const REDACT_CENSOR = "[Redacted]";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type CreateLoggerOptions = {
  /** Service name, e.g. "api", "worker". Appears as `name` in every line. */
  name: string;
  level?: LogLevel;
  /** Human-friendly output via pino-pretty. Development only — never in production. */
  pretty?: boolean;
  /** Extra static bindings (environment, version, ...). */
  base?: Record<string, unknown>;
};

export const createLogger = (
  options: CreateLoggerOptions,
  destination?: DestinationStream,
): Logger => {
  const { name, level = "info", pretty = false, base } = options;

  const loggerOptions: LoggerOptions = {
    name,
    level,
    ...(base ? { base } : {}),
    redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (destination) {
    return pino(loggerOptions, destination);
  }

  if (pretty) {
    return pino({
      ...loggerOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
      },
    });
  }

  return pino(loggerOptions);
};

/** Child logger with request/job scoped bindings (requestId, jobId, userId, ...). */
export const childLogger = (parent: Logger, bindings: Record<string, unknown>): Logger =>
  parent.child(bindings);

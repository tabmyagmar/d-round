import { destination as stdoutDestination, multistream, pino } from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";
import pinoPretty from "pino-pretty";

import type { DiscordAlertStream } from "./discord-alert-stream";

export type { Logger };
export { createDiscordAlertStream } from "./discord-alert-stream";
export type { DiscordAlertStream, DiscordAlertStreamOptions } from "./discord-alert-stream";

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
  /** Also receives every error and fatal line (createDiscordAlertStream, docs/adr/0010-alerts.md). */
  alerts?: DiscordAlertStream;
};

export const createLogger = (
  options: CreateLoggerOptions,
  destination?: DestinationStream,
): Logger => {
  const { name, level = "info", pretty = false, base, alerts } = options;

  const loggerOptions: LoggerOptions = {
    name,
    level,
    ...(base ? { base } : {}),
    redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // pino-pretty runs in-process, not as a transport thread, so it can share a multistream with
  // the alerts. Without either, pino writes to stdout itself.
  const output =
    destination ??
    (pretty
      ? pinoPretty({ colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" })
      : undefined);

  if (!alerts) {
    return pino(loggerOptions, output);
  }

  return pino(
    loggerOptions,
    multistream([
      // The logger's own level filters first; this entry takes every line it lets through.
      { level: "trace", stream: output ?? stdoutDestination(1) },
      { level: "error", stream: alerts },
    ]),
  );
};

/** Child logger with request/job scoped bindings (requestId, jobId, userId, ...). */
export const childLogger = (parent: Logger, bindings: Record<string, unknown>): Logger =>
  parent.child(bindings);

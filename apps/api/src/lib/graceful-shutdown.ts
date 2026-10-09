import type { Logger } from "@repo/logger";

export type ShutdownStep = { name: string; run: () => unknown };

export type GracefulShutdownOptions = {
  logger: Pick<Logger, "info" | "error" | "warn" | "fatal">;
  steps: ShutdownStep[];
  /** Hard deadline after which the process exits even if steps are still running. */
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  process?: Pick<NodeJS.Process, "on" | "exit" | "off">;
};

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Runs shutdown steps in order (stop accepting → drain → close connections) on SIGTERM /
 * SIGINT, exactly once, with a hard deadline. An uncaught exception or unhandled rejection is
 * logged as fatal and runs the same steps, then exits 1: without these handlers Node prints the
 * stack and exits at once, and no step runs (the alerts' flush among them). Returns the shutdown
 * function so callers can also trigger it programmatically (e.g. on fatal errors, exit code 1).
 */
export const registerGracefulShutdown = (
  options: GracefulShutdownOptions,
): ((reason: string, exitCode?: number) => Promise<void>) => {
  const {
    logger,
    steps,
    timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    signals = ["SIGTERM", "SIGINT"],
    process: proc = process,
  } = options;
  let shuttingDown: Promise<void> | undefined;
  // The highest code any caller asked for: a crash during a running shutdown still exits 1.
  let code = 0;

  const shutdown = (reason: string, exitCode = 0): Promise<void> => {
    code = Math.max(code, exitCode);
    if (shuttingDown) {
      return shuttingDown;
    }
    shuttingDown = (async () => {
      logger.info({ reason }, "shutting down");
      const deadline = setTimeout(() => {
        logger.fatal({ timeoutMs }, "shutdown timed out, forcing exit");
        proc.exit(1);
      }, timeoutMs);
      deadline.unref();

      let failed = false;
      for (const step of steps) {
        try {
          await step.run();
          logger.info({ step: step.name }, "shutdown step done");
        } catch (error) {
          failed = true;
          logger.error({ step: step.name, err: error }, "shutdown step failed");
        }
      }

      clearTimeout(deadline);
      proc.exit(failed ? 1 : code);
    })();
    return shuttingDown;
  };

  for (const signal of signals) {
    proc.on(signal, () => {
      void shutdown(signal);
    });
  }
  proc.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    void shutdown("uncaughtException", 1);
  });
  proc.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandled rejection");
    void shutdown("unhandledRejection", 1);
  });

  return shutdown;
};

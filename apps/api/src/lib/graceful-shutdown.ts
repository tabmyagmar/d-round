import type { Logger } from "@repo/logger";

export type ShutdownStep = { name: string; run: () => unknown };

export type GracefulShutdownOptions = {
  logger: Pick<Logger, "info" | "error" | "warn">;
  steps: ShutdownStep[];
  /** Hard deadline after which the process exits even if steps are still running. */
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  process?: Pick<NodeJS.Process, "on" | "exit" | "off">;
};

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Runs shutdown steps in order (stop accepting → drain → close connections) on SIGTERM /
 * SIGINT, exactly once, with a hard deadline. Returns the shutdown function so callers can
 * also trigger it programmatically (e.g. on fatal errors).
 */
export const registerGracefulShutdown = (
  options: GracefulShutdownOptions,
): ((reason: string) => Promise<void>) => {
  const {
    logger,
    steps,
    timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    signals = ["SIGTERM", "SIGINT"],
    process: proc = process,
  } = options;
  let shuttingDown: Promise<void> | undefined;

  const shutdown = (reason: string): Promise<void> => {
    if (shuttingDown) {
      return shuttingDown;
    }
    shuttingDown = (async () => {
      logger.info({ reason }, "shutting down");
      const deadline = setTimeout(() => {
        logger.error({ timeoutMs }, "shutdown timed out, forcing exit");
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
      proc.exit(failed ? 1 : 0);
    })();
    return shuttingDown;
  };

  for (const signal of signals) {
    proc.on(signal, () => {
      void shutdown(signal);
    });
  }

  return shutdown;
};

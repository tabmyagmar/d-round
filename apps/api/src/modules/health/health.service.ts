/**
 * Readiness check of the API's hard dependencies. This service is infrastructure-level and
 * therefore the one exception to the "services take ctx first" rule — there is no request
 * user involved and it must work before any request context exists.
 */

export type HealthProbe = () => Promise<unknown>;

export type HealthProbes = Record<string, HealthProbe>;

export type CheckStatus = "ok" | "error";

export type HealthReport = {
  status: "ok" | "degraded";
  checks: Record<string, CheckStatus>;
  /** Failure reasons, keyed by check name. Never contains connection strings. */
  errors: Record<string, string>;
  checkedAt: string;
};

export const DEFAULT_PROBE_TIMEOUT_MS = 2000;

const withTimeout = async (probe: HealthProbe, timeoutMs: number): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);
  });
  try {
    await Promise.race([probe(), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

export const checkHealth = async (
  probes: HealthProbes,
  options: { timeoutMs?: number } = {},
): Promise<HealthReport> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const checks: Record<string, CheckStatus> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    Object.entries(probes).map(async ([name, probe]) => {
      try {
        await withTimeout(probe, timeoutMs);
        checks[name] = "ok";
      } catch (error) {
        checks[name] = "error";
        errors[name] = describeError(error);
      }
    }),
  );

  return {
    status: Object.values(checks).every((status) => status === "ok") ? "ok" : "degraded",
    checks,
    errors,
    checkedAt: new Date().toISOString(),
  };
};

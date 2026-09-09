import type { PrismaClient } from "@repo/database";
import type { RedisConnection } from "@repo/queue";

import type { HealthProbes } from "../modules/health/health.service";

/** Concrete probes for the two hard dependencies of the API process. */
export const createHealthProbes = (deps: {
  db: PrismaClient;
  redis: RedisConnection;
}): HealthProbes => ({
  database: () => deps.db.$queryRaw`SELECT 1`,
  redis: () => deps.redis.ping(),
});

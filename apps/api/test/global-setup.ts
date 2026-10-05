import type { TestProject } from "vitest/node";

import { startTestDatabase } from "@repo/database/test";
import type { TestDatabase } from "@repo/database/test";
import { startTestRedis } from "@repo/queue/test";
import type { TestRedis } from "@repo/queue/test";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation needs declaration merging
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

let database: TestDatabase | undefined;
let redis: TestRedis | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  [database, redis] = await Promise.all([
    startTestDatabase({ seedReferenceData: true }),
    startTestRedis(),
  ]);
  project.provide("databaseUrl", database.connectionString);
  project.provide("redisUrl", redis.url);
};

export const teardown = async (): Promise<void> => {
  await Promise.all([database?.stop(), redis?.stop()]);
  database = undefined;
  redis = undefined;
};

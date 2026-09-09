import type { TestProject } from "vitest/node";

import { startTestRedis } from "./index";
import type { TestRedis } from "./index";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation needs declaration merging
  export interface ProvidedContext {
    redisUrl: string;
  }
}

let redis: TestRedis | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  redis = await startTestRedis();
  project.provide("redisUrl", redis.url);
};

export const teardown = async (): Promise<void> => {
  await redis?.stop();
  redis = undefined;
};

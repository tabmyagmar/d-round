import { RedisContainer } from "@testcontainers/redis";
import type { StartedRedisContainer } from "@testcontainers/redis";

/**
 * Testcontainers helper shared by every package that touches Redis/BullMQ.
 * Same image as docker-compose.yml.
 */
export const TEST_REDIS_IMAGE = process.env["TEST_REDIS_IMAGE"] ?? "redis:8-alpine";

export type TestRedis = {
  container: StartedRedisContainer;
  url: string;
  stop: () => Promise<void>;
};

export const startTestRedis = async (): Promise<TestRedis> => {
  const container = await new RedisContainer(TEST_REDIS_IMAGE).start();
  return {
    container,
    url: container.getConnectionUrl(),
    stop: () => container.stop().then(() => undefined),
  };
};

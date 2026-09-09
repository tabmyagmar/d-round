import { Redis } from "ioredis";
import type { RedisOptions } from "ioredis";

export type RedisConnection = Redis;

/**
 * ioredis 6 declares `replyMapping` without `| undefined`, which clashes with
 * `exactOptionalPropertyTypes`; we never set it (RESP3 default mapping), so it is omitted.
 */
export type RedisConnectionOptions = Omit<RedisOptions, "replyMapping">;

/**
 * BullMQ needs `maxRetriesPerRequest: null` — blocking commands (BRPOPLPUSH & friends)
 * must be allowed to wait indefinitely, otherwise workers die on every Redis hiccup.
 */
export const REDIS_CONNECTION_DEFAULTS = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
} satisfies RedisConnectionOptions;

export const redisConnectionOptions = (
  overrides: RedisConnectionOptions = {},
): RedisConnectionOptions => ({
  ...REDIS_CONNECTION_DEFAULTS,
  ...overrides,
});

/**
 * One connection per role: queues/producers share one, every Worker gets its own (BullMQ
 * duplicates it for blocking commands), pub/sub uses dedicated ones (see pubsub.ts).
 */
export const createRedisConnection = (
  url: string,
  overrides?: RedisConnectionOptions,
): RedisConnection => new Redis(url, redisConnectionOptions(overrides));

/** Resolves once the connection can serve commands; rejects on the first connection error. */
export const waitForRedis = (connection: RedisConnection): Promise<void> =>
  new Promise((resolve, reject) => {
    if (connection.status === "ready") {
      resolve();
      return;
    }
    const onReady = (): void => {
      connection.off("error", onError);
      resolve();
    };
    const onError = (error: Error): void => {
      connection.off("ready", onReady);
      reject(error);
    };
    connection.once("ready", onReady);
    connection.once("error", onError);
  });

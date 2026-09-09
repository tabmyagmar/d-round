import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import type { RateLimiterAbstract } from "rate-limiter-flexible";

import type { RedisConnection } from "@repo/queue";

export type RateLimitOptions = {
  keyPrefix: string;
  /** Allowed attempts per `durationSeconds` per key. */
  points: number;
  durationSeconds: number;
  /** Extra lock-out after the limit is hit (seconds). */
  blockDurationSeconds?: number;
};

export const SIGN_IN_RATE_LIMIT: RateLimitOptions = {
  keyPrefix: "rl:sign-in",
  points: 10,
  durationSeconds: 60,
  blockDurationSeconds: 60,
};

export const createRateLimiter = (
  redis: RedisConnection,
  options: RateLimitOptions,
): RateLimiterAbstract =>
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.durationSeconds,
    ...(options.blockDurationSeconds === undefined
      ? {}
      : { blockDuration: options.blockDurationSeconds }),
  });

/** Client IP: first X-Forwarded-For entry (behind a proxy), else the socket address. */
export const clientIp = (c: Context): string => {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
};

/** Responds 429 + Retry-After once the key exhausted its points. */
export const rateLimit =
  (limiter: RateLimiterAbstract, keyFor: (c: Context) => string = clientIp): MiddlewareHandler =>
  async (c, next) => {
    try {
      await limiter.consume(keyFor(c));
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) {
        c.header("Retry-After", String(Math.max(1, Math.ceil(rejection.msBeforeNext / 1000))));
        return c.json({ error: "Too many requests" }, 429);
      }
      throw rejection;
    }
    return next();
  };

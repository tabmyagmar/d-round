import { describe, expect, it } from "vitest";

import { REDIS_CONNECTION_DEFAULTS, redisConnectionOptions } from "../src/connection";

describe("redisConnectionOptions", () => {
  it("never limits retries per request (required by BullMQ blocking commands)", () => {
    expect(REDIS_CONNECTION_DEFAULTS.maxRetriesPerRequest).toBeNull();
    expect(redisConnectionOptions().maxRetriesPerRequest).toBeNull();
  });

  it("connects eagerly with ready check enabled", () => {
    const options = redisConnectionOptions();
    expect(options.lazyConnect).toBe(false);
    expect(options.enableReadyCheck).toBe(true);
  });

  it("lets callers override individual options", () => {
    const options = redisConnectionOptions({ connectionName: "api", db: 2 });
    expect(options).toMatchObject({ connectionName: "api", db: 2, maxRetriesPerRequest: null });
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  createPubSub,
  createQueue,
  createRedisConnection,
  createWorker,
  jobIdFor,
  waitForRedis,
} from "../src/index";
import type { RedisConnection } from "../src/index";

type Payload = { entityId: string };

let connection: RedisConnection;

beforeAll(async () => {
  connection = createRedisConnection(inject("redisUrl"), { connectionName: "queue-test" });
  await waitForRedis(connection);
});

afterAll(async () => {
  await connection.quit();
});

describe("queue + worker against real Redis", () => {
  it("processes a job, applies default job options and deduplicates by jobId", async () => {
    const queueName = `it-${crypto.randomUUID()}`;
    const processed: string[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstProcessed = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const queue = createQueue<Payload>(queueName, connection);
    const worker = createWorker<Payload>(
      queueName,
      async (job) => {
        processed.push(job.data.entityId);
        resolveFirst?.();
        return Promise.resolve();
      },
      connection,
    );

    try {
      const jobId = jobIdFor("entity", "abc");
      const first = await queue.add("process", { entityId: "abc" }, { jobId });
      // Same deterministic id → BullMQ returns the existing job instead of adding a new one.
      const duplicate = await queue.add("process", { entityId: "abc" }, { jobId });

      expect(first.id).toBe(jobId);
      expect(duplicate.id).toBe(jobId);
      expect(first.opts.attempts).toBe(5);
      expect(first.opts.backoff).toEqual({ type: "exponential", delay: 3000 });

      await firstProcessed;
      // Give BullMQ a moment to move the job to completed before counting.
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(processed).toEqual(["abc"]);
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed");
      expect(counts["failed"]).toBe(0);
      expect(counts["waiting"]).toBe(0);
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

describe("pub/sub", () => {
  it("delivers messages to subscribers and stops after unsubscribe", async () => {
    const pubsub = createPubSub(inject("redisUrl"));
    const channel = `chan-${crypto.randomUUID()}`;
    const received: string[] = [];

    try {
      const unsubscribe = await pubsub.subscribe(channel, (message) => {
        received.push(message);
      });

      await pubsub.publish(channel, "invalidate:1");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toEqual(["invalidate:1"]);

      await unsubscribe();
      await pubsub.publish(channel, "invalidate:2");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(received).toEqual(["invalidate:1"]);
    } finally {
      await pubsub.close();
    }
  });
});

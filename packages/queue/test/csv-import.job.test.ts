import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  QUEUE_NAMES,
  createCsvImportQueue,
  createRedisConnection,
  createWorker,
  csvCheckJobId,
  csvImportJobId,
  enqueueCsvCheckJob,
  enqueueCsvImportJob,
  waitForRedis,
} from "../src/index";
import type { CsvImportJob, RedisConnection } from "../src/index";

let connection: RedisConnection;

beforeAll(async () => {
  connection = createRedisConnection(inject("redisUrl"), { connectionName: "csv-import-job-test" });
  await waitForRedis(connection);
});

afterAll(async () => {
  await connection.quit();
});

describe("csv import jobs", () => {
  it("derive their ids from the import, so a second enqueue of the same job is a no-op", async () => {
    const queue = createCsvImportQueue(connection);
    const csvImportId = crypto.randomUUID();

    expect(csvCheckJobId(csvImportId)).toBe(`csv-check-${csvImportId}`);
    expect(csvImportJobId(csvImportId)).toBe(`csv-import-${csvImportId}`);
    const check = await enqueueCsvCheckJob(queue, csvImportId, "req-1");
    const again = await enqueueCsvCheckJob(queue, csvImportId);
    const run = await enqueueCsvImportJob(queue, csvImportId);

    expect(again.id).toBe(check.id);
    expect(check).toMatchObject({ name: "check", data: { csvImportId, traceId: "req-1" } });
    expect(run).toMatchObject({ name: "import", data: { csvImportId } });
    expect(run.id).not.toBe(check.id);
    await check.remove();
    await run.remove();
    await queue.close();
  });

  it("retry a check but run an import once, and drop a job that failed for good", async () => {
    const queue = createCsvImportQueue(connection);
    const csvImportId = crypto.randomUUID();
    const check = await enqueueCsvCheckJob(queue, csvImportId);
    const run = await enqueueCsvImportJob(queue, csvImportId);

    expect(queue.defaultJobOptions).toMatchObject({ attempts: 5, removeOnFail: true });
    expect(check.opts.attempts).toBe(5);
    expect(run.opts.attempts).toBe(1);
    await check.remove();
    await run.remove();
    await queue.close();
  });

  it("let a job that failed for good be enqueued again under its id", async () => {
    const queue = createCsvImportQueue(connection);
    const csvImportId = crypto.randomUUID();
    const worker = createWorker<CsvImportJob>(
      QUEUE_NAMES.csvImport,
      () => Promise.reject(new Error("the import broke")),
      connection,
    );
    const failed = new Promise<void>((resolve) => {
      worker.on("failed", () => {
        resolve();
      });
    });

    try {
      await enqueueCsvImportJob(queue, csvImportId);
      await failed;
      await worker.close();

      // Dropped at once (`removeOnFail`): the sweeper's re-enqueue under the same id is not a no-op.
      expect(await queue.getJob(csvImportJobId(csvImportId))).toBeUndefined();
      const again = await enqueueCsvImportJob(queue, csvImportId);
      expect(await again.getState()).toBe("waiting");
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import {
  attachmentDeleteJobId,
  createAttachmentDeleteQueue,
  createRedisConnection,
  enqueueAttachmentDeleteJob,
  waitForRedis,
} from "../src/index";
import type { RedisConnection } from "../src/index";

let connection: RedisConnection;

beforeAll(async () => {
  connection = createRedisConnection(inject("redisUrl"), { connectionName: "attachment-job-test" });
  await waitForRedis(connection);
});

afterAll(async () => {
  await connection.quit();
});

describe("attachment delete job", () => {
  it("derives the job id from the row and collapses duplicates", async () => {
    const queue = createAttachmentDeleteQueue(connection);
    const attachmentId = crypto.randomUUID();

    expect(attachmentDeleteJobId(attachmentId)).toBe(`attachment-delete-${attachmentId}`);
    const first = await enqueueAttachmentDeleteJob(queue, attachmentId);
    const second = await enqueueAttachmentDeleteJob(queue, attachmentId);

    expect(second.id).toBe(first.id);
    expect(first.data).toEqual({ attachmentId });
    expect(first.name).toBe("delete");
    await first.remove();
    await queue.close();
  });

  it("retries like every queue but drops a job that failed every attempt", async () => {
    const queue = createAttachmentDeleteQueue(connection);

    expect(queue.defaultJobOptions).toMatchObject({ attempts: 5, removeOnFail: true });
    await queue.close();
  });
});

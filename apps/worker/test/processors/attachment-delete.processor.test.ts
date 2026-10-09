import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attachmentDeleteJobId, enqueueAttachmentDeleteJob } from "@repo/queue";
import { createMemoryStorage } from "@repo/storage";

import { createAttachmentDeleteWorker } from "../../src/processors/attachment-delete.processor";
import type { WorkerHarness } from "../support";
import {
  createAttachmentRow,
  createWorkerHarness,
  isolatedAttachmentDeleteQueue,
  waitForJobDone,
} from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

/** Runs one delete job for `attachmentId` through a real worker on an isolated queue. */
const runDeleteJob = async (
  attachmentId: string,
  storage = createMemoryStorage(),
): Promise<string> => {
  const { name, queue } = isolatedAttachmentDeleteQueue(h.connection);
  const worker = createAttachmentDeleteWorker({ ...h, storage, queueName: name });
  try {
    await enqueueAttachmentDeleteJob(queue, attachmentId);
    return await waitForJobDone(queue, attachmentDeleteJobId(attachmentId));
  } finally {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
};

describe("attachment delete processor", () => {
  it("deletes the object of a DELETED row, then the row", async () => {
    const storage = createMemoryStorage();
    const row = await createAttachmentRow(h.db, { status: "DELETED" });
    storage.put(row.objectKey, { size: row.size, contentType: row.contentType });

    expect(await runDeleteJob(row.id, storage)).toBe("completed");

    expect(storage.keys()).not.toContain(row.objectKey);
    expect(await h.db.attachment.findUnique({ where: { id: row.id } })).toBeNull();
  });

  it("retries when the bucket fails, and leaves an attached row and a missing row alone", async () => {
    const flaky = createMemoryStorage({ failFirstDeletes: 1 });
    const deleted = await createAttachmentRow(h.db, { status: "DELETED" });
    flaky.put(deleted.objectKey, { size: 1, contentType: "image/png" });
    const attached = await createAttachmentRow(h.db, { status: "ATTACHED" });
    const storage = createMemoryStorage();
    storage.put(attached.objectKey, { size: 1, contentType: "image/png" });

    expect(await runDeleteJob(deleted.id, flaky)).toBe("completed");
    expect(await runDeleteJob(attached.id, storage)).toBe("completed");
    expect(await runDeleteJob(crypto.randomUUID())).toBe("completed");

    expect(await h.db.attachment.findUnique({ where: { id: deleted.id } })).toBeNull();
    expect(flaky.keys()).toEqual([]);
    expect((await h.db.attachment.findUniqueOrThrow({ where: { id: attached.id } })).status).toBe(
      "ATTACHED",
    );
    expect(storage.keys()).toEqual([attached.objectKey]);
  });

  it("keeps the row DELETED when the bucket fails every attempt, for the sweeper", async () => {
    const down = createMemoryStorage({ failFirstDeletes: 10 });
    const row = await createAttachmentRow(h.db, { status: "DELETED" });
    const { name, queue } = isolatedAttachmentDeleteQueue(h.connection);
    const worker = createAttachmentDeleteWorker({ ...h, storage: down, queueName: name });
    try {
      const lastFailure = new Promise<number>((resolve) => {
        worker.on("failed", (job) => {
          if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
            resolve(job.attemptsMade);
          }
        });
      });
      await enqueueAttachmentDeleteJob(queue, row.id);

      expect(await lastFailure).toBe(2);
      // Dropped from the queue (removeOnFail), so the sweeper can enqueue the same id again.
      expect(await queue.getJob(attachmentDeleteJobId(row.id))).toBeUndefined();
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }

    expect((await h.db.attachment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      "DELETED",
    );
  });

  it("fails a delete the bucket refuses at once, keeping the row DELETED for the sweeper", async () => {
    const refusing = createMemoryStorage({ refuseDeletes: true });
    const row = await createAttachmentRow(h.db, { status: "DELETED" });
    const { name, queue } = isolatedAttachmentDeleteQueue(h.connection);
    const worker = createAttachmentDeleteWorker({ ...h, storage: refusing, queueName: name });
    try {
      const failed = new Promise<number>((resolve) => {
        worker.on("failed", (job) => {
          resolve(job?.attemptsMade ?? -1);
        });
      });
      await enqueueAttachmentDeleteJob(queue, row.id, "req-refused");

      expect(await failed).toBe(1);
      expect((await h.db.attachment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
        "DELETED",
      );
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

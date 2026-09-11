import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enqueueEmailJob } from "@repo/queue";

import { createMemoryMailProvider } from "../../src/mail/memory-mail-provider";
import { createEmailWorker } from "../../src/processors/email.processor";
import {
  createPendingEmail,
  createWorkerHarness,
  isolatedEmailQueue,
  sleep,
  waitForFinalStatus,
  waitForJobDone,
} from "../support";
import type { WorkerHarness } from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("email processor", () => {
  it("sends a PENDING row exactly once, even when the job is enqueued twice", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection);
    const provider = createMemoryMailProvider();
    const worker = createEmailWorker({ ...h, provider, queueName: name });
    try {
      const row = await createPendingEmail(h.db, { to: "once@example.com" });

      await enqueueEmailJob(queue, row.id, "trace-1");
      await enqueueEmailJob(queue, row.id, "trace-1"); // deterministic id → no-op

      const final = await waitForFinalStatus(h.db, row.id);
      expect(final.status).toBe("SENT");
      expect(final.attempts).toBe(1);
      expect(final.sentAt).toBeInstanceOf(Date);
      expect(provider.sent).toHaveLength(1);
      expect(provider.sent[0]?.to).toBe("once@example.com");
      expect(provider.sent[0]?.text).toContain("https://app.example.com/verify?token=t");
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("is idempotent: a job for an already SENT row does nothing", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection);
    const provider = createMemoryMailProvider();
    const worker = createEmailWorker({ ...h, provider, queueName: name });
    try {
      const row = await createPendingEmail(h.db);
      await h.db.outboxEmail.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), attempts: 1 },
      });

      const job = await enqueueEmailJob(queue, row.id);
      expect(await waitForJobDone(queue, job.id ?? "")).toBe("completed");

      expect(provider.sent).toHaveLength(0);
      expect((await h.db.outboxEmail.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(
        1,
      );
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("retries transient failures and records each attempt on the row", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection, { attempts: 3, backoffMs: 20 });
    const provider = createMemoryMailProvider({ failFirst: 2 });
    const worker = createEmailWorker({ ...h, provider, queueName: name });
    try {
      const row = await createPendingEmail(h.db);
      await enqueueEmailJob(queue, row.id);

      const final = await waitForFinalStatus(h.db, row.id);
      expect(final.status).toBe("SENT");
      expect(final.attempts).toBe(3);
      expect(provider.sent).toHaveLength(1);
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("marks the row FAILED with lastError when every attempt fails", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection, { attempts: 2, backoffMs: 20 });
    const provider = createMemoryMailProvider({ failFirst: 99 });
    const worker = createEmailWorker({ ...h, provider, queueName: name });
    try {
      const row = await createPendingEmail(h.db);
      await enqueueEmailJob(queue, row.id);

      const final = await waitForFinalStatus(h.db, row.id);
      expect(final.status).toBe("FAILED");
      expect(final.attempts).toBe(2);
      expect(final.lastError).toContain("smtp unavailable");
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("marks permanent failures (bad template, rejected address) FAILED on the first attempt", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection, { attempts: 5 });
    const provider = createMemoryMailProvider({ alwaysFailPermanently: true });
    const worker = createEmailWorker({ ...h, provider, queueName: name });
    try {
      const badTemplate = await createPendingEmail(h.db, { template: "does-not-exist" });
      const badAddress = await createPendingEmail(h.db);
      await enqueueEmailJob(queue, badTemplate.id);
      await enqueueEmailJob(queue, badAddress.id);

      const [t, a] = await Promise.all([
        waitForFinalStatus(h.db, badTemplate.id),
        waitForFinalStatus(h.db, badAddress.id),
      ]);
      expect(t.status).toBe("FAILED");
      expect(t.lastError).toContain("Unknown email template");
      expect(a.status).toBe("FAILED");
      expect(a.attempts).toBe(1);
      expect(a.lastError).toContain("mailbox does not exist");

      await sleep(100);
      expect(provider.attempts).toBe(1); // no retries for permanent failures
    } finally {
      await worker.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

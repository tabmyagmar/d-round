import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emailJobId } from "@repo/queue";

import { createMemoryMailProvider } from "../../src/mail/memory-mail-provider";
import { createEmailWorker } from "../../src/processors/email.processor";
import { sweepOutboxEmails } from "../../src/schedulers/outbox-sweeper";
import type { WorkerHarness } from "../support";
import {
  createPendingEmail,
  createWorkerHarness,
  isolatedEmailQueue,
  waitForFinalStatus,
} from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("outbox sweeper", () => {
  it("re-enqueues PENDING rows whose job was lost (Redis flushed) and leaves the rest alone", async () => {
    const { name, queue } = isolatedEmailQueue(h.connection);
    try {
      // Committed rows whose enqueue never happened / was wiped from Redis.
      const lost = await createPendingEmail(h.db, { ageMs: 5 * 60_000 });
      const fresh = await createPendingEmail(h.db); // inside the grace period
      const failed = await createPendingEmail(h.db, { ageMs: 5 * 60_000 });
      await h.db.outboxEmail.update({ where: { id: failed.id }, data: { status: "FAILED" } });

      const count = await sweepOutboxEmails({
        db: h.db,
        emailQueue: queue,
        logger: h.logger,
        graceMs: 60_000,
      });

      expect(count).toBeGreaterThanOrEqual(1);
      expect(await queue.getJob(emailJobId(lost.id))).not.toBeNull();
      expect(await queue.getJob(emailJobId(fresh.id))).toBeUndefined();
      expect(await queue.getJob(emailJobId(failed.id))).toBeUndefined();

      // A worker picks the recovered job up and delivers exactly once.
      const provider = createMemoryMailProvider();
      const worker = createEmailWorker({ ...h, provider, queueName: name });
      try {
        const final = await waitForFinalStatus(h.db, lost.id);
        expect(final.status).toBe("SENT");
        expect(provider.sent.filter((m) => m.to === lost.to)).toHaveLength(1);
      } finally {
        await worker.close();
      }
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("is safe to run repeatedly: existing jobs are not duplicated", async () => {
    const { queue } = isolatedEmailQueue(h.connection);
    try {
      const row = await createPendingEmail(h.db, { ageMs: 5 * 60_000 });

      await sweepOutboxEmails({ db: h.db, emailQueue: queue, logger: h.logger });
      await sweepOutboxEmails({ db: h.db, emailQueue: queue, logger: h.logger });

      const counts = await queue.getJobCounts("waiting", "delayed", "active");
      const jobs = await queue.getJobs(["waiting", "delayed", "active"]);
      expect(jobs.filter((j) => j.data.outboxEmailId === row.id)).toHaveLength(1);
      expect((counts["waiting"] ?? 0) + (counts["delayed"] ?? 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

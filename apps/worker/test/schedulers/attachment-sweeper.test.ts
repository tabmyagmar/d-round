import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attachmentDeleteJobId } from "@repo/queue";

import {
  ATTACHMENT_DELETE_GRACE_MS,
  ATTACHMENT_PENDING_TTL_MS,
  sweepAttachments,
} from "../../src/schedulers/attachment-sweeper";
import type { WorkerHarness } from "../support";
import {
  createAttachmentRow,
  createWorkerHarness,
  isolatedAttachmentDeleteQueue,
} from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("attachment sweeper", () => {
  it("expires stale uploads and enqueues deletes the worker lost, nothing else", async () => {
    const { queue } = isolatedAttachmentDeleteQueue(h.connection);
    try {
      const stalePending = await createAttachmentRow(h.db, {
        ageMs: ATTACHMENT_PENDING_TTL_MS + 60_000,
      });
      const freshPending = await createAttachmentRow(h.db, { ageMs: 60_000 });
      const lostDelete = await createAttachmentRow(h.db, {
        status: "DELETED",
        ageMs: ATTACHMENT_DELETE_GRACE_MS + 60_000,
      });
      const freshDelete = await createAttachmentRow(h.db, { status: "DELETED" });
      const attached = await createAttachmentRow(h.db, {
        status: "ATTACHED",
        ageMs: ATTACHMENT_PENDING_TTL_MS + 60_000,
      });

      const result = await sweepAttachments({
        db: h.db,
        attachmentDeleteQueue: queue,
        logger: h.logger,
      });

      const statusOf = async (id: string) =>
        (await h.db.attachment.findUniqueOrThrow({ where: { id } })).status;
      expect(result.expired).toBeGreaterThanOrEqual(1);
      expect(result.requeued).toBeGreaterThanOrEqual(1);
      expect(await statusOf(stalePending.id)).toBe("DELETED");
      expect(await statusOf(freshPending.id)).toBe("PENDING");
      expect(await statusOf(attached.id)).toBe("ATTACHED");
      const lost = await queue.getJob(attachmentDeleteJobId(lostDelete.id));
      expect(lost?.data).toEqual({ attachmentId: lostDelete.id });
      // Created 11 minutes ago: its upload URL still works for a few minutes, so the job waits.
      expect(lost?.opts.delay).toBeGreaterThan(0);
      expect(await queue.getJob(attachmentDeleteJobId(freshDelete.id))).toBeUndefined();
      // Expired now, enqueued by a later sweep once its grace period passed.
      expect(await queue.getJob(attachmentDeleteJobId(stalePending.id))).toBeUndefined();

      const later = new Date(Date.now() + ATTACHMENT_DELETE_GRACE_MS + 60_000);
      await sweepAttachments({
        db: h.db,
        attachmentDeleteQueue: queue,
        logger: h.logger,
        now: () => later,
      });
      await sweepAttachments({
        db: h.db,
        attachmentDeleteQueue: queue,
        logger: h.logger,
        now: () => later,
      });

      expect(await queue.getJob(attachmentDeleteJobId(stalePending.id))).toBeDefined();
      const jobs = await queue.getJobs(["waiting", "delayed", "active"]);
      expect(jobs.filter((job) => job.data.attachmentId === lostDelete.id)).toHaveLength(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

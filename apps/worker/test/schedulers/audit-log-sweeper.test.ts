import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuditLogRepository } from "@repo/database";
import { createQueue } from "@repo/queue";

import {
  auditLogCutoff,
  registerAuditLogSweeper,
  sweepAuditLogs,
} from "../../src/schedulers/audit-log-sweeper";
import type { AuditLogSweepJob } from "../../src/schedulers/audit-log-sweeper";
import { createWorkerHarness } from "../support";
import type { WorkerHarness } from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** A row created `days` ago, labelled so the test finds it again. */
const rowAged = (days: number, label: string) =>
  createAuditLogRepository(h.db).create({
    actorType: "USER",
    action: "client.update",
    entityLabel: label,
    status: "SUCCESS",
    createdAt: new Date(Date.now() - days * DAY_MS),
  });

describe("audit log sweeper", () => {
  it("cuts at midnight in Japan, 90 days back", () => {
    // 2026-10-14 03:30 in Japan.
    expect(auditLogCutoff(new Date("2026-10-13T18:30:00Z")).toISOString()).toBe(
      "2026-07-15T15:00:00.000Z",
    );
  });

  it("deletes the rows past the retention in batches, keeps the rest and records how many", async () => {
    const run = crypto.randomUUID();
    const old = await Promise.all(
      [120, 110, 100, 95, 92].map((days) => rowAged(days, `old-${run}`)),
    );
    const young = await rowAged(10, `young-${run}`);

    const result = await sweepAuditLogs({ db: h.db, logger: h.logger, batch: 2 });

    expect(result.deleted).toBeGreaterThanOrEqual(old.length);
    expect(await h.db.auditLog.count({ where: { entityLabel: `old-${run}` } })).toBe(0);
    expect(await h.db.auditLog.findUnique({ where: { id: young.id } })).not.toBeNull();
    const purges = await h.db.auditLog.findMany({
      where: { action: "system.auditLogPurge", createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    expect(purges).toEqual([
      expect.objectContaining({
        actorType: "SYSTEM",
        actorId: null,
        entityType: "AuditLog",
        status: "SUCCESS",
        changes: [{ field: "deletedCount", before: null, after: String(result.deleted) }],
      }),
    ]);

    expect(await sweepAuditLogs({ db: h.db, logger: h.logger })).toMatchObject({ deleted: 0 });
    expect(
      await h.db.auditLog.count({
        where: {
          action: "system.auditLogPurge",
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      }),
    ).toBe(1);
  });

  it("registers one daily scheduler on Japan's clock, however often it is registered", async () => {
    const queue = createQueue<AuditLogSweepJob>(
      `audit-log-sweeper-test-${crypto.randomUUID()}`,
      h.connection,
    );
    try {
      await registerAuditLogSweeper(queue);
      await registerAuditLogSweeper(queue);

      const schedulers = await queue.getJobSchedulers();
      expect(schedulers).toHaveLength(1);
      expect(schedulers[0]).toMatchObject({ pattern: "0 4 * * *", tz: "Asia/Tokyo" });
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CSV_CHECK_INTERRUPTED, CSV_IMPORT_INTERRUPTED } from "@repo/api/jobs";
import { csvCheckJobId, csvImportJobId } from "@repo/queue";

import { sweepCsvImports } from "../../src/schedulers/csv-import-sweeper";
import type { WorkerHarness } from "../support";
import { createCsvImportRow, createWorkerHarness, isolatedCsvImportQueue } from "../support";

let h: WorkerHarness;

beforeAll(async () => {
  h = await createWorkerHarness();
});

afterAll(async () => {
  await h.stop();
});

const MINUTE = 60_000;

describe("csv import sweeper", () => {
  it("enqueues again the jobs of uploaded and confirmed imports that lost them", async () => {
    const { queue } = isolatedCsvImportQueue(h.connection);
    try {
      const uploaded = await createCsvImportRow(h.db, { status: "UPLOADED", ageMs: 2 * MINUTE });
      const confirmed = await createCsvImportRow(h.db, { status: "CONFIRMED", ageMs: 2 * MINUTE });
      const fresh = await createCsvImportRow(h.db, { status: "UPLOADED" });

      const result = await sweepCsvImports({ db: h.db, csvImportQueue: queue, logger: h.logger });
      await sweepCsvImports({ db: h.db, csvImportQueue: queue, logger: h.logger });

      expect(result.requeued).toBeGreaterThanOrEqual(2);
      expect((await queue.getJob(csvCheckJobId(uploaded.id)))?.name).toBe("check");
      expect((await queue.getJob(csvImportJobId(confirmed.id)))?.name).toBe("import");
      expect(await queue.getJob(csvCheckJobId(fresh.id))).toBeUndefined();
      const counts = await queue.getJobCounts("waiting");
      expect(counts.waiting).toBe(result.requeued);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("fails a check or an import that stopped, with the reason, and never runs it again", async () => {
    const { queue } = isolatedCsvImportQueue(h.connection);
    try {
      const checking = await createCsvImportRow(h.db, { status: "CHECKING", ageMs: 11 * MINUTE });
      const importing = await createCsvImportRow(h.db, { status: "IMPORTING", ageMs: 11 * MINUTE });
      const running = await createCsvImportRow(h.db, { status: "IMPORTING", ageMs: MINUTE });

      const result = await sweepCsvImports({ db: h.db, csvImportQueue: queue, logger: h.logger });

      expect(result.failed).toBeGreaterThanOrEqual(2);
      const stored = (id: string) => h.db.csvImport.findUniqueOrThrow({ where: { id } });
      expect(await stored(checking.id)).toMatchObject({
        status: "FAILED",
        lastError: CSV_CHECK_INTERRUPTED,
      });
      expect(await stored(importing.id)).toMatchObject({
        status: "FAILED",
        lastError: CSV_IMPORT_INTERRUPTED,
      });
      expect((await stored(running.id)).status).toBe("IMPORTING");
      expect(await queue.getJob(csvImportJobId(importing.id))).toBeUndefined();
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

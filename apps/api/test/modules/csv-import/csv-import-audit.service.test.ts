import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCsvImportRepository } from "@repo/database";

import { runCsvImport } from "../../../src/modules/csv-import/csv-import.runner";
import * as csvImportService from "../../../src/modules/csv-import/csv-import.service";
import { contextDeps, contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

import { checkedRows, startImport } from "./csv-flow";
import { userCsv, userLine } from "./user-csv";

/** The audit rows of a CSV import (docs/adr/0015-audit-log.md). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("a CSV import in the audit log", () => {
  it("records the upload, the confirmation and each imported 担当者 as the uploader's", async () => {
    const admin = await signedInUser(h, { role: "admin", profile: {} });
    const first = userLine({ lastName: "取込" });
    const second = userLine({ lastName: "取込" });
    const csvImport = await startImport(
      h,
      await contextFor(h, admin.headers),
      userCsv(first.text, second.text),
    );
    const lineNumbers = (await checkedRows(h, csvImport.id)).map((row) => row.lineNumber);
    const confirming = await contextFor(h, admin.headers);

    await csvImportService.confirm(confirming, { csvImportId: csvImport.id, lineNumbers });
    await runCsvImport(contextDeps(h), {
      csvImportId: csvImport.id,
      traceId: confirming.requestId,
      lastAttempt: true,
    });

    expect(
      (
        await h.db.auditLog.findMany({
          where: { entityId: csvImport.id },
          orderBy: { action: "desc" },
        })
      ).map((row) => [row.action, row.entityLabel, row.changes]),
    ).toEqual([
      [
        "csvImport.create",
        "取込.csv",
        [
          { field: "type", before: null, after: "担当者 追加" },
          { field: "fileName", before: null, after: "取込.csv" },
        ],
      ],
      ["csvImport.confirm", "取込.csv", [{ field: "selectedCount", before: null, after: "2" }]],
    ]);
    const imported = await createCsvImportRepository(h.db).findRows(csvImport.id);
    const invites = await h.db.auditLog.findMany({
      where: { action: "user.invite", entityId: { in: imported.map((row) => row.entityId ?? "") } },
    });
    expect(invites).toHaveLength(2);
    expect(invites.map((row) => [row.actorId, row.requestId, row.ipAddress])).toEqual([
      [admin.user.id, confirming.requestId, null],
      [admin.user.id, confirming.requestId, null],
    ]);
  });
});

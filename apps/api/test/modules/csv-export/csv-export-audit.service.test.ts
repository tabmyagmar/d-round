import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCsvExportSchema } from "@repo/validation";

import * as clientService from "../../../src/modules/client/client.service";
import * as csvExportService from "../../../src/modules/csv-export/csv-export.service";
import {
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
} from "../../support";
import type { TestHarness } from "../../support";

/** The audit rows of the CSV downloads (docs/adr/0015-audit-log.md). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

describe("CSV downloads in the audit log", () => {
  it("records what a download holds and a file handed out again, never the file or its URL", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const client = await clientService.create(ctx, clientInput([(await signedInUser(h)).user.id]));

    const csvExport = await csvExportService.create(
      ctx,
      createCsvExportSchema.parse({ type: "CLIENT", ids: [client.id], fields: ["number", "name"] }),
    );
    const again = await csvExportService.downloadUrl(ctx, csvExport.id);

    const rows = await h.db.auditLog.findMany({
      where: { entityId: csvExport.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(rows.map((row) => [row.action, row.actorId, row.entityType, row.entityLabel])).toEqual([
      ["csvExport.create", admin.user.id, "CsvExport", csvExport.fileName],
      ["csvExport.downloadUrl", admin.user.id, "CsvExport", csvExport.fileName],
    ]);
    expect(rows[0]?.changes).toEqual([
      { field: "type", before: null, after: "クライアント" },
      { field: "fileName", before: null, after: csvExport.fileName },
      { field: "rowCount", before: null, after: "1" },
      {
        field: "columns",
        before: null,
        after: "クライアント情報: クライアント番号,クライアント名",
      },
    ]);
    expect(rows[1]?.changes).toEqual([]);
    expect(JSON.stringify(rows)).not.toContain(again.url);
    expect(JSON.stringify(rows)).not.toContain(csvExport.url);
  });
});

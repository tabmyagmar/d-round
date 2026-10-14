import { createCsvImportRepository } from "@repo/database";
import { createUploadUrlSchema } from "@repo/validation";
import type { CsvImportType } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { createUploadUrl } from "../../../src/modules/attachment/attachment.service";
import { runCsvCheck, runCsvImport } from "../../../src/modules/csv-import/csv-import.runner";
import * as csvImportService from "../../../src/modules/csv-import/csv-import.service";
import { contextDeps } from "../../support";
import type { TestHarness } from "../../support";

/** A CSV import end to end in the tests: upload, check, confirm, import — the worker's runs inline. */

/**
 * Uploads `text` as the browser does — an upload URL of kind CSV_IMPORT, then the PUT into the
 * memory bucket — and starts its import through the service.
 */
export const startImport = async (
  h: TestHarness,
  ctx: RequestContext,
  text: string,
  type: CsvImportType = "USER_CREATE",
) => {
  const body = new TextEncoder().encode(text);
  const target = await createUploadUrl(
    ctx,
    createUploadUrlSchema.parse({
      kind: "CSV_IMPORT",
      fileName: "取込.csv",
      contentType: "text/csv",
      size: body.length,
    }),
  );
  const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
  h.storage.put(row.objectKey, { size: body.length, contentType: "text/csv", body });
  return csvImportService.create(ctx, { type, attachmentId: target.id });
};

/** The check job's run; the import's rows afterwards. */
export const checkedRows = async (h: TestHarness, csvImportId: string) => {
  await runCsvCheck(contextDeps(h), { csvImportId, lastAttempt: true });
  return createCsvImportRepository(h.db).findRows(csvImportId);
};

/** Confirms every row without errors and runs the import job; the rows afterwards. */
export const importValidRows = async (h: TestHarness, ctx: RequestContext, csvImportId: string) => {
  const repo = createCsvImportRepository(h.db);
  const lineNumbers = (await repo.findRows(csvImportId))
    .filter((row) => row.errors.length === 0)
    .map((row) => row.lineNumber);
  await csvImportService.confirm(ctx, { csvImportId, lineNumbers });
  await runCsvImport(contextDeps(h), { csvImportId, lastAttempt: true });
  return repo.findRows(csvImportId);
};

import {
  createAttachmentRepository,
  createCsvImportRepository,
  withTransaction,
} from "@repo/database";
import type { CsvImportRowOutcome } from "@repo/database";
import { z } from "@repo/validation";
import { decodeCsv, parseCsv } from "@repo/validation/csv";
import type { CsvCells } from "@repo/validation/csv";

import { buildJobContext } from "../../core/context";
import type { ContextDeps } from "../../core/context";
import { ConflictError, isDomainError } from "../../core/errors";

import { loadCsvLookups, rowErrorMessage } from "./csv-importer";
import { CSV_IMPORTERS } from "./importers";

/**
 * The two CSV jobs (docs/adr/0013-csv-import.md), run by apps/worker through `@repo/api/jobs`. Each
 * re-reads the import, claims it (a second run of the same job changes nothing) and acts for the
 * uploader with their current grants. Messages the user reads are stored in `last_error`.
 */

export const CSV_UPLOADER_INACTIVE =
  "アップロードした担当者が利用停止されているため、処理できませんでした";
export const CSV_FILE_MISSING =
  "アップロードされたファイルが見つかりません。もう一度アップロードしてください";
export const CSV_TYPE_UNSUPPORTED = "この種類のCSVはまだ取り込めません";
export const CSV_CHECK_FAILED = "確認中にエラーが発生しました。もう一度アップロードしてください";
export const CSV_IMPORT_FAILED =
  "登録中にエラーが発生しました。結果を確認し、登録されていない行をもう一度アップロードしてください";
/** The sweeper's reasons, for a check or an import whose job stopped without a word. */
export const CSV_CHECK_INTERRUPTED = "確認が中断されました。もう一度アップロードしてください";
export const CSV_IMPORT_INTERRUPTED =
  "登録が中断されました。結果を確認し、登録されていない行をもう一度アップロードしてください";

export type CsvJobInput = {
  csvImportId: string;
  traceId?: string | undefined;
  /** BullMQ will not try the job again: a failure now is final. */
  lastAttempt: boolean;
};

/** What a run did, for the worker's log: `missing` means the import row is gone. */
export type CsvJobOutcome = "missing" | "skipped" | "checked" | "imported" | "failed";

const loggerOf = (deps: ContextDeps, job: CsvJobInput) =>
  deps.logger.child({ csvImportId: job.csvImportId, traceId: job.traceId ?? null });

/** A stored row's cells (written by the check as a JSON object of strings). */
const cellsOf = (data: unknown): CsvCells =>
  typeof data === "object" && data !== null && !Array.isArray(data)
    ? Object.fromEntries(
        Object.entries(data).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};

/**
 * The check job (UPLOADED → CHECKED): reads the stored file, checks every row — format, in-file
 * duplicates, the database — and stores the rows with their errors. A failure is retried; the
 * last attempt marks the import FAILED.
 */
export const runCsvCheck = async (deps: ContextDeps, job: CsvJobInput): Promise<CsvJobOutcome> => {
  const log = loggerOf(deps, job);
  const imports = createCsvImportRepository(deps.db);
  const csvImport = await imports.findById(job.csvImportId);
  if (!csvImport) {
    return "missing";
  }
  if (!(await imports.claimCheck(csvImport.id))) {
    log.info({ status: csvImport.status }, "csv check: the import moved on; nothing to do");
    return "skipped";
  }
  const fail = async (reason: string) => {
    await imports.markFailed(csvImport.id, "CHECKING", reason);
    log.warn({ reason }, "csv check refused the import");
    return "failed" as const;
  };

  try {
    const runner = CSV_IMPORTERS[csvImport.type];
    if (!runner) {
      return await fail(CSV_TYPE_UNSUPPORTED);
    }
    const ctx = await buildJobContext(
      { userId: csvImport.createdById, traceId: job.traceId },
      deps,
    );
    if (!ctx) {
      return await fail(CSV_UPLOADER_INACTIVE);
    }
    const [file] = await createAttachmentRepository(deps.db).findAttached(
      { csvImportId: csvImport.id },
      "CSV_IMPORT",
    );
    const bytes = file ? await deps.storage.download(file.objectKey) : null;
    if (!bytes) {
      return await fail(CSV_FILE_MISSING);
    }

    const parsed = parseCsv(decodeCsv(bytes), runner.definition.columns);
    const rows = parsed.fileError
      ? []
      : await runner.check(ctx, parsed.lines, await loadCsvLookups(deps.db));
    const summary = {
      totalCount: rows.length,
      validCount: rows.filter((row) => row.errors.length === 0).length,
      fileError: parsed.fileError,
    };
    try {
      await withTransaction(deps.db, async ({ tx }) => {
        const locked = createCsvImportRepository(tx);
        await locked.replaceRows(
          csvImport.id,
          rows.map((row) => ({ lineNumber: row.lineNumber, data: row.cells, errors: row.errors })),
        );
        if (!(await locked.markChecked(csvImport.id, summary))) {
          // The sweeper failed it meanwhile: keep its verdict, store nothing.
          throw new ConflictError("The import left CHECKING during its check");
        }
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        log.warn("csv check: the import left CHECKING; its rows were not stored");
        return "skipped";
      }
      throw error;
    }
    log.info({ total: summary.totalCount, valid: summary.validCount }, "csv checked");
    return "checked";
  } catch (error) {
    if (!job.lastAttempt) {
      log.warn({ err: error }, "csv check failed; it will be tried again");
      throw error;
    }
    log.error({ err: error }, "csv check failed for good; the import is FAILED");
    await imports.markFailed(csvImport.id, "CHECKING", CSV_CHECK_FAILED);
    return "failed";
  }
};

/**
 * The import job (CONFIRMED → IMPORTED), run once: each confirmed row through the entity's service
 * in its own transaction; a refused row records its message and the next one goes on (D8).
 */
export const runCsvImport = async (deps: ContextDeps, job: CsvJobInput): Promise<CsvJobOutcome> => {
  const log = loggerOf(deps, job);
  const imports = createCsvImportRepository(deps.db);
  const csvImport = await imports.findById(job.csvImportId);
  if (!csvImport) {
    return "missing";
  }
  if (!(await imports.claimImport(csvImport.id))) {
    log.info({ status: csvImport.status }, "csv import: the import moved on; nothing to do");
    return "skipped";
  }
  const fail = async (reason: string) => {
    await imports.markFailed(csvImport.id, "IMPORTING", reason);
    log.warn({ reason }, "csv import refused the import");
    return "failed" as const;
  };

  try {
    const runner = CSV_IMPORTERS[csvImport.type];
    if (!runner) {
      return await fail(CSV_TYPE_UNSUPPORTED);
    }
    const ctx = await buildJobContext(
      { userId: csvImport.createdById, traceId: job.traceId },
      deps,
    );
    if (!ctx) {
      return await fail(CSV_UPLOADER_INACTIVE);
    }
    const lookups = await loadCsvLookups(deps.db);
    for (const row of await imports.findRowsToImport(csvImport.id)) {
      let outcome: CsvImportRowOutcome;
      try {
        const line = { lineNumber: row.lineNumber, cells: cellsOf(row.data) };
        outcome = { result: "IMPORTED", entityId: await runner.importLine(ctx, line, lookups) };
      } catch (error) {
        if (!isDomainError(error) && !(error instanceof z.ZodError)) {
          log.error({ err: error, lineNumber: row.lineNumber }, "csv row failed unexpectedly");
        }
        outcome = { result: "FAILED", resultError: rowErrorMessage(error) };
      }
      await imports.recordRowResult(row.id, outcome);
      await imports.incrementProcessed(csvImport.id);
    }
    const counts = await imports.countResults(csvImport.id);
    await imports.markImported(csvImport.id, {
      importedCount: counts.imported,
      failedCount: counts.failed,
    });
    log.info(counts, "csv imported");
    return "imported";
  } catch (error) {
    log.error({ err: error }, "csv import failed; the import is FAILED");
    await imports.markFailed(csvImport.id, "IMPORTING", CSV_IMPORT_FAILED);
    return "failed";
  }
};

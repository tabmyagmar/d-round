import {
  createAttachmentRepository,
  createCsvImportRepository,
  withTransaction,
} from "@repo/database";
import type { CsvImport, CsvImportListItem, CsvImportRow, PageResult } from "@repo/database";
import { canUnscoped } from "@repo/permissions/server";
import { enqueueCsvCheckJob, enqueueCsvImportJob } from "@repo/queue";
import type {
  AuditAction,
  AuditChange,
  ConfirmCsvImportInput,
  CreateCsvImportInput,
  CsvImportType,
  ListCsvImportsQuery,
} from "@repo/validation";
import { toCsvText } from "@repo/validation/csv";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { UPLOAD_EXPIRED, assertUploaded, syncAttachments } from "../attachment/attachment.service";
import { diffViews, recordChanges } from "../audit-log/audit-log.service";
import type { AuditEntry } from "../audit-log/audit-log.service";
import { csvImportTypeLabelOf } from "../audit-log/audit-views";

import { uploaderOf } from "./csv-importer";
import { CSV_IMPORTERS } from "./importers";

/**
 * CSV imports as the screens use them (docs/adr/0013-csv-import.md): start one from an uploaded
 * file, confirm the rows to import, follow its progress, page its history, download the rows
 * that need attention. The work itself is the worker's (`csv-import.runner.ts`). Every import is
 * its uploader's only, for every role (the legacy rule).
 */

export const CSV_NOT_CONFIRMABLE = "この取込は確定できません。履歴から状況を確認してください";
export const CSV_LINES_NOT_IMPORTABLE = "エラーのある行、またはファイルにない行は登録できません";
export const CSV_ROW_NOT_PROCESSED = "処理が中断されたため、登録されたか確認できませんでした";

/** What each type writes, and so the grant its uploader needs besides catalog 1401. */
const ENTITY_GRANTS = {
  USER_CREATE: { action: "create", subject: "User", label: "担当者の追加" },
  USER_UPDATE: { action: "update", subject: "User", label: "担当者の更新" },
  STAFF_CREATE: { action: "create", subject: "Staff", label: "スタッフの追加" },
  STAFF_UPDATE: { action: "update", subject: "Staff", label: "スタッフの更新" },
  CLIENT_CREATE: { action: "create", subject: "Client", label: "クライアントの追加" },
  CLIENT_UPDATE: { action: "update", subject: "Client", label: "クライアントの更新" },
  BRANCH_CREATE: { action: "create", subject: "Branch", label: "就業先部署の追加" },
  BRANCH_UPDATE: { action: "update", subject: "Branch", label: "就業先部署の更新" },
} as const satisfies Record<
  CsvImportType,
  { action: "create" | "update"; subject: "User" | "Staff" | "Client" | "Branch"; label: string }
>;

/** Catalog 1401 and the grant to write the type's entity (the self rule is not enough). */
const assertMayImport = (ctx: RequestContext, type: CsvImportType): void => {
  const grant = ENTITY_GRANTS[type];
  if (
    !ctx.ability.can("create", "SourceCsvHistory") ||
    !canUnscoped(ctx.ability, grant.action, grant.subject)
  ) {
    throw new ForbiddenError(`CSVで${grant.label}をする権限がありません`);
  }
};

/**
 * History, an import's lines and its error CSV (D11): catalog 1402 and the read of every row of
 * the entity, checked here as well as in the router.
 */
const assertMayRead = (ctx: RequestContext, type: CsvImportType): void => {
  if (
    !ctx.ability.can("read", "SourceCsvHistory") ||
    !canUnscoped(ctx.ability, "read", ENTITY_GRANTS[type].subject)
  ) {
    throw new ForbiddenError("このCSV取込を見る権限がありません");
  }
};

/** The caller's own import; another user's is not found, so its existence does not leak. */
const ownImport = async (ctx: RequestContext, csvImportId: string): Promise<CsvImport> => {
  const uploader = uploaderOf(ctx);
  const csvImport = await createCsvImportRepository(ctx.db).findById(csvImportId);
  if (csvImport?.createdById !== uploader.id) {
    throw new NotFoundError("CsvImport", csvImportId);
  }
  return csvImport;
};

/** The caller's own import, which they may read now. */
const readableImport = async (ctx: RequestContext, csvImportId: string): Promise<CsvImport> => {
  const csvImport = await ownImport(ctx, csvImportId);
  assertMayRead(ctx, csvImport.type);
  return csvImport;
};

/** After commit; a failed enqueue is logged and the sweeper enqueues it a minute later. */
const enqueueAfterCommit =
  (ctx: RequestContext, enqueue: () => Promise<unknown>, csvImportId: string) => async () => {
    try {
      await enqueue();
    } catch (error) {
      ctx.logger.error({ err: error, csvImportId }, "csv job not enqueued; the sweeper retries");
    }
  };

/**
 * The audit log's row of an import (docs/adr/0015-audit-log.md); the entities it writes are
 * recorded by their own services, with the uploader as actor and this request's id.
 */
const csvImportAuditEntry = (
  action: AuditAction,
  csvImport: CsvImport,
  changes: AuditChange[],
): AuditEntry => ({
  action,
  entityType: "CsvImport",
  entityId: csvImport.id,
  entityLabel: csvImport.fileName,
  changes,
});

/**
 * Starts the import of an uploaded CSV (`attachment.createUploadUrl`, kind CSV_IMPORT): the import
 * row and the file's attachment in one transaction, the check job after commit.
 */
export const create = async (
  ctx: RequestContext,
  input: CreateCsvImportInput,
): Promise<CsvImport> => {
  const uploader = uploaderOf(ctx);
  assertMayImport(ctx, input.type);
  await assertUploaded(ctx, "CSV_IMPORT", [input.attachmentId]);
  const file = await createAttachmentRepository(ctx.db).findById(input.attachmentId);
  if (!file) {
    throw new ValidationError(UPLOAD_EXPIRED);
  }

  return withTransaction(ctx.db, async (transaction) => {
    const csvImport = await createCsvImportRepository(transaction.tx).create({
      type: input.type,
      fileName: file.fileName,
      createdById: uploader.id,
    });
    await syncAttachments(ctx, transaction, {
      kind: "CSV_IMPORT",
      owner: { csvImportId: csvImport.id },
      ids: [input.attachmentId],
    });
    await recordChanges(ctx, transaction.tx, [
      csvImportAuditEntry(
        "csvImport.create",
        csvImport,
        diffViews(null, {
          type: csvImportTypeLabelOf(csvImport.type),
          fileName: csvImport.fileName,
        }),
      ),
    ]);
    transaction.afterCommit(
      enqueueAfterCommit(
        ctx,
        () => enqueueCsvCheckJob(ctx.csvImportQueue, csvImport.id, ctx.requestId),
        csvImport.id,
      ),
    );
    return csvImport;
  });
};

/** Confirms the rows to import (rows the check found no error in) and enqueues the import. */
export const confirm = async (
  ctx: RequestContext,
  input: ConfirmCsvImportInput,
): Promise<CsvImport> => {
  const uploader = uploaderOf(ctx);
  const csvImport = await ownImport(ctx, input.csvImportId);
  assertMayImport(ctx, csvImport.type);
  if (csvImport.status !== "CHECKED") {
    throw new ConflictError(CSV_NOT_CONFIRMABLE);
  }

  return withTransaction(ctx.db, async ({ tx, afterCommit }) => {
    const imports = createCsvImportRepository(tx);
    const selected = await imports.selectRows(csvImport.id, input.lineNumbers);
    if (selected !== input.lineNumbers.length) {
      throw new ValidationError(CSV_LINES_NOT_IMPORTABLE);
    }
    if (!(await imports.markConfirmed(csvImport.id, uploader.id, selected))) {
      throw new ConflictError(CSV_NOT_CONFIRMABLE);
    }
    afterCommit(
      enqueueAfterCommit(
        ctx,
        () => enqueueCsvImportJob(ctx.csvImportQueue, csvImport.id, ctx.requestId),
        csvImport.id,
      ),
    );
    const confirmed = await imports.findById(csvImport.id);
    if (!confirmed) {
      throw new NotFoundError("CsvImport", csvImport.id);
    }
    await recordChanges(ctx, tx, [
      csvImportAuditEntry("csvImport.confirm", confirmed, [
        { field: "selectedCount", before: null, after: String(selected) },
      ]),
    ]);
    return confirmed;
  });
};

export const byId = (ctx: RequestContext, csvImportId: string): Promise<CsvImport> =>
  readableImport(ctx, csvImportId);

/** The import's rows in CSV order (150 at most): cells, errors, choice and result. */
export const rows = async (ctx: RequestContext, csvImportId: string): Promise<CsvImportRow[]> => {
  const csvImport = await readableImport(ctx, csvImportId);
  return createCsvImportRepository(ctx.db).findRows(csvImport.id);
};

/** 履歴: the caller's imports of one type, newest first. */
export const list = async (
  ctx: RequestContext,
  query: ListCsvImportsQuery,
): Promise<PageResult<CsvImportListItem>> => {
  assertMayRead(ctx, query.type);
  return createCsvImportRepository(ctx.db).findPage(
    { page: query.page, perPage: query.perPage },
    { createdById: uploaderOf(ctx).id, type: query.type },
  );
};

/** The message of a row that needs attention, or null for a row that is fine. */
const attentionOf = (csvImport: CsvImport, row: CsvImportRow): string | null => {
  if (row.errors.length > 0) {
    return row.errors.join("; ");
  }
  if (row.result === "FAILED") {
    return row.resultError;
  }
  const finished = csvImport.status === "IMPORTED" || csvImport.status === "FAILED";
  return finished && row.selected && row.result === null ? CSV_ROW_NOT_PROCESSED : null;
};

const textOf = (data: unknown, key: string): string => {
  const value =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>)[key] : "";
  return typeof value === "string" ? value : "";
};

/**
 * The rows that need attention as a CSV Excel opens (D9): the type's columns with the cells as
 * read, then 行番号 and エラー内容 — the file to fix and upload again. Rendered from the rows, so
 * it never disagrees with the history.
 */
export const errorCsv = async (
  ctx: RequestContext,
  csvImportId: string,
): Promise<{ fileName: string; text: string }> => {
  const csvImport = await readableImport(ctx, csvImportId);
  const columns = CSV_IMPORTERS[csvImport.type].definition.columns;
  const lines = (await createCsvImportRepository(ctx.db).findRows(csvImport.id)).flatMap((row) => {
    const message = attentionOf(csvImport, row);
    return message === null
      ? []
      : [
          [
            ...columns.map((column) => textOf(row.data, column.key)),
            String(row.lineNumber),
            message,
          ],
        ];
  });
  const baseName = csvImport.fileName.replace(/\.csv$/iu, "");
  return {
    fileName: `${baseName}_エラー.csv`,
    text: toCsvText([
      [...columns.map((column) => column.header), "行番号", "エラー内容"],
      ...lines,
    ]),
  };
};

import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";

/**
 * What a CSV file adds or updates — the database enum `CsvImportType` matches (the legacy
 * EnumCsvUploadType). An UPDATE row finds its target by its number column. The CSV reader and
 * the type definitions are the separate entry `@repo/validation/csv`.
 */
export const CSV_IMPORT_TYPES = [
  "USER_CREATE",
  "USER_UPDATE",
  "STAFF_CREATE",
  "STAFF_UPDATE",
  "CLIENT_CREATE",
  "CLIENT_UPDATE",
  "BRANCH_CREATE",
  "BRANCH_UPDATE",
] as const;
export const csvImportTypeSchema = z.enum(CSV_IMPORT_TYPES);
export type CsvImportType = z.infer<typeof csvImportTypeSchema>;

/** Data rows one file may hold (the legacy limit, now inclusive). */
export const CSV_MAX_ROWS = 150;

/** Starts the import of an uploaded file (`attachment.createUploadUrl` of kind `CSV_IMPORT`). */
export const createCsvImportSchema = z.object({
  type: csvImportTypeSchema,
  attachmentId: idSchema,
});
export type CreateCsvImportInput = z.infer<typeof createCsvImportSchema>;

export const csvImportIdSchema = z.object({ csvImportId: idSchema });

/** The rows to import, by their CSV row number (the header is row 1): rows without errors only. */
export const confirmCsvImportSchema = z.object({
  csvImportId: idSchema,
  lineNumbers: z
    .array(z.int().min(2))
    .min(1, { error: "登録する行を選択してください" })
    .max(CSV_MAX_ROWS)
    .refine((lines) => new Set(lines).size === lines.length, { error: "行が重複しています" }),
});
export type ConfirmCsvImportInput = z.infer<typeof confirmCsvImportSchema>;

/** 履歴: one type's imports of the caller, newest first. */
export const listCsvImportsSchema = paginationSchema.extend({ type: csvImportTypeSchema });
export type ListCsvImportsInput = z.input<typeof listCsvImportsSchema>;
export type ListCsvImportsQuery = z.output<typeof listCsvImportsSchema>;

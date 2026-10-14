import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type CsvImportOutputs = inferRouterOutputs<AppRouter>["csvImport"];
type CsvExportOutputs = inferRouterOutputs<AppRouter>["csvExport"];

/** `csvImport.byId`: an import's status and counts (superjson keeps the dates). */
export type CsvImport = CsvImportOutputs["byId"];

/** A row of `csvImport.rows`: one CSV line, its cells as read, the check's errors, its result. */
export type CsvImportRow = CsvImportOutputs["rows"][number];

/** A row of `csvImport.list` (履歴), with its uploader. */
export type CsvImportListItem = CsvImportOutputs["list"]["items"][number];

/** A row of `csvExport.list` (ダウンロード履歴), with who made it. */
export type CsvExportListItem = CsvExportOutputs["list"]["items"][number];

/** The four lists with a 「CSV」 menu. */
export type CsvEntity = "user" | "staff" | "client" | "branch";

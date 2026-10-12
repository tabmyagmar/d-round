import type { CsvImportType } from "@repo/validation/csv";

import { csvTypeRunner } from "../csv-importer";
import type { CsvTypeRunner } from "../csv-importer";

import { userCreateImporter, userUpdateImporter } from "./user.importer";

/**
 * Every CSV type the import handles (D12). Partial while the epic ports the entities one by one
 * (担当者 first); a type without an importer fails its import with a message.
 */
export const CSV_IMPORTERS: Partial<Record<CsvImportType, CsvTypeRunner>> = {
  USER_CREATE: csvTypeRunner(userCreateImporter),
  USER_UPDATE: csvTypeRunner(userUpdateImporter),
};

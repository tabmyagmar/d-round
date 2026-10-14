import type { CsvImportType } from "@repo/validation";

import { csvTypeRunner } from "../csv-importer";
import type { CsvTypeRunner } from "../csv-importer";

import { branchCreateImporter, branchUpdateImporter } from "./branch.importer";
import { clientCreateImporter, clientUpdateImporter } from "./client.importer";
import { staffCreateImporter, staffUpdateImporter } from "./staff.importer";
import { userCreateImporter, userUpdateImporter } from "./user.importer";

/**
 * Every CSV type and its importer (D12): a type added to `CsvImportType` does not compile until it
 * has one here, and nothing else branches on the type.
 */
export const CSV_IMPORTERS: Record<CsvImportType, CsvTypeRunner> = {
  USER_CREATE: csvTypeRunner(userCreateImporter),
  USER_UPDATE: csvTypeRunner(userUpdateImporter),
  STAFF_CREATE: csvTypeRunner(staffCreateImporter),
  STAFF_UPDATE: csvTypeRunner(staffUpdateImporter),
  CLIENT_CREATE: csvTypeRunner(clientCreateImporter),
  CLIENT_UPDATE: csvTypeRunner(clientUpdateImporter),
  BRANCH_CREATE: csvTypeRunner(branchCreateImporter),
  BRANCH_UPDATE: csvTypeRunner(branchUpdateImporter),
};

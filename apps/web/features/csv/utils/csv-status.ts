import type { StatusTone } from "@repo/ui/components/composed/status-badge";

import type { CsvImport } from "@/features/csv/types";

export type CsvImportStatus = CsvImport["status"];

/** The import dialog's steps (legacy: upload dialog, then 履歴 → detail → 確定). */
export const CSV_IMPORT_STEPS = ["ファイル選択", "内容確認", "登録", "結果"] as const;

/** How often the dialog and 履歴 ask again while the worker is on an import (D10). */
export const CSV_POLL_INTERVAL_MS = 2000;

const WORKING: ReadonlySet<CsvImportStatus> = new Set([
  "UPLOADED",
  "CHECKING",
  "CONFIRMED",
  "IMPORTING",
]);

/** The worker has the import (checking or importing): its counts are still moving. */
export const isCsvImportWorking = (status: CsvImportStatus | undefined): boolean =>
  status !== undefined && WORKING.has(status);

/** The step an import is at (D4): 内容確認 until confirmed, 登録 while importing, then 結果. */
const STEP_OF: Readonly<Record<CsvImportStatus, number>> = {
  UPLOADED: 1,
  CHECKING: 1,
  CHECKED: 1,
  CONFIRMED: 2,
  IMPORTING: 2,
  IMPORTED: 3,
  FAILED: 3,
};

export const csvImportStepOf = (status: CsvImportStatus): number => STEP_OF[status];

type StatusSource = Pick<
  CsvImport,
  "status" | "totalCount" | "validCount" | "failedCount" | "fileError"
>;

/** ステータス as 履歴 shows it (legacy `STATUS_MAP`, plus システムエラー for a failed job). */
export const csvImportStatusOf = (csvImport: StatusSource): { label: string; tone: StatusTone } => {
  switch (csvImport.status) {
    case "UPLOADED":
    case "CHECKING":
      return { label: "確認中", tone: "warning" };
    case "CHECKED":
      return csvImport.fileError !== null || csvImport.validCount < csvImport.totalCount
        ? { label: "確認エラー", tone: "danger" }
        : { label: "確認完了", tone: "success" };
    case "CONFIRMED":
    case "IMPORTING":
      return { label: "登録中", tone: "warning" };
    case "IMPORTED":
      return csvImport.failedCount > 0
        ? { label: "登録エラー", tone: "danger" }
        : { label: "登録済み", tone: "success" };
    case "FAILED":
      return { label: "システムエラー", tone: "danger" };
  }
};

/**
 * 履歴's アクション (D4): 登録 opens a checked import at 内容確認, 確認 a finished one at 結果; none
 * while the worker has it.
 */
export const csvImportActionOf = (status: CsvImportStatus): "登録" | "確認" | null => {
  if (status === "CHECKED") {
    return "登録";
  }
  return status === "IMPORTED" || status === "FAILED" ? "確認" : null;
};

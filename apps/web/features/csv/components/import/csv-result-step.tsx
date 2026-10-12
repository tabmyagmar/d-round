"use client";

import { Download } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

import { CsvRowsTable } from "@/features/csv/components/import/csv-rows-table";
import type { CsvImport, CsvImportRow } from "@/features/csv/types";
import type { CsvSummaryColumn } from "@/features/csv/utils/csv-type-content";

export type CsvResultStepProps = {
  csvImport: CsvImport;
  /** The import's lines with their results; undefined while they load. */
  rows: CsvImportRow[] | undefined;
  summary: readonly CsvSummaryColumn[];
  downloading: boolean;
  onDownloadErrors: () => void;
  onClose: () => void;
};

/**
 * 結果 (legacy 履歴 → 確認): the counts, the confirmed lines with what became of each, and the
 * error CSV whenever a line needs attention — refused by the check, refused by the import, or
 * never reached when the import stopped (a system failure, `lastError`).
 */
export const CsvResultStep = ({
  csvImport,
  rows,
  summary,
  downloading,
  onDownloadErrors,
  onClose,
}: CsvResultStepProps) => {
  const notReached = csvImport.selectedCount - csvImport.processedCount;
  const needsAttention =
    csvImport.failedCount > 0 || notReached > 0 || csvImport.validCount < csvImport.totalCount;

  return (
    <div className="flex flex-col gap-4">
      {csvImport.status === "FAILED" ? (
        <Alert variant="destructive">
          <AlertTitle>取込を完了できませんでした</AlertTitle>
          <AlertDescription>{csvImport.lastError}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-sm tabular-nums">
        登録: {csvImport.importedCount} 件
        <span className="ml-3 text-muted-foreground">
          エラー: {csvImport.failedCount} 件
          {notReached > 0 ? ` / 未登録: ${String(notReached)} 件` : ""}
        </span>
      </p>
      <div className="max-h-[50vh] overflow-y-auto">
        <CsvRowsTable
          rows={rows?.filter((row) => row.selected)}
          isLoading={rows === undefined}
          summary={summary}
          mode="result"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {needsAttention ? (
          <Button variant="outline" disabled={downloading} onClick={onDownloadErrors}>
            <Download data-icon="inline-start" />
            エラーCSV
          </Button>
        ) : null}
        <Button onClick={onClose}>閉じる</Button>
      </div>
    </div>
  );
};

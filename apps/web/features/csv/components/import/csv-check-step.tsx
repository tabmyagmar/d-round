"use client";

import { Download, Info } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import type { DataTableRowSelectionState } from "@repo/ui/components/composed/data-table";
import { LoadingState } from "@repo/ui/components/composed/loading-state";
import { FormActions } from "@repo/ui/components/form";

import { CsvRowsTable } from "@/features/csv/components/import/csv-rows-table";
import type { CsvImport, CsvImportRow } from "@/features/csv/types";
import type { CsvSummaryColumn } from "@/features/csv/utils/csv-type-content";

export type CsvCheckStepProps = {
  csvImport: CsvImport;
  /** The import's lines once checked; undefined while they load. */
  rows: CsvImportRow[] | undefined;
  summary: readonly CsvSummaryColumn[];
  /** 確定 is being sent. */
  pending: boolean;
  /** The error CSV is being prepared. */
  downloading: boolean;
  onConfirm: (lineNumbers: number[]) => void;
  onDownloadErrors: () => void;
  onClose: () => void;
};

const importable = (row: CsvImportRow) => row.errors.length === 0;

/** Every importable line, chosen: the legacy ticked them all when the detail opened. */
const allImportable = (rows: CsvImportRow[]): DataTableRowSelectionState =>
  Object.fromEntries(rows.filter(importable).map((row) => [String(row.lineNumber), true]));

/** The checked lines, their choice and 確定; mounted once the lines are loaded. */
const CheckedRows = ({
  csvImport,
  rows,
  summary,
  pending,
  downloading,
  onConfirm,
  onDownloadErrors,
  onClose,
}: CsvCheckStepProps & { rows: CsvImportRow[] }) => {
  const [selection, setSelection] = useState(() => allImportable(rows));
  const selected = rows.filter((row) => selection[String(row.lineNumber)]);
  const refused = csvImport.totalCount - csvImport.validCount;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(selected.map((row) => row.lineNumber));
      }}
    >
      <div className="flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-sm leading-relaxed text-accent-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          このままアップロードするデータの最前列にあるチェックボックスを選択してください。
          <br />
          取込不可なデータはアップロードすることはできないため、CSVデータを修正してから再度アップロードお願いします。
        </p>
      </div>
      <p className="text-sm">
        取込データ入数: {csvImport.totalCount}
        <span className="ml-3 text-muted-foreground">
          取込可能: {csvImport.validCount} / 取込不可: {refused}
        </span>
      </p>
      <div className="max-h-[50vh] overflow-y-auto">
        <CsvRowsTable
          rows={rows}
          isLoading={false}
          summary={summary}
          mode="check"
          rowSelection={{
            state: selection,
            onChange: setSelection,
            canSelect: importable,
            labels: {
              all: "取込可能な行をすべて選択",
              row: (row) => `${String(row.lineNumber)}行目を選択`,
            },
          }}
        />
      </div>
      <FormActions
        submitLabel="確定"
        pendingLabel="確定中…"
        pending={pending}
        disabled={selected.length === 0}
      >
        <Button type="button" variant="outline" onClick={onClose}>
          閉じる
        </Button>
        {refused > 0 ? (
          <Button type="button" variant="outline" disabled={downloading} onClick={onDownloadErrors}>
            <Download data-icon="inline-start" />
            エラーCSV
          </Button>
        ) : null}
      </FormActions>
    </form>
  );
};

/**
 * 内容確認 (legacy 履歴 → 登録 → 【データ確認】): while the worker checks the file, a waiting
 * message; then each line with its errors, the importable lines ticked, and 確定. A finding about
 * the whole file (a missing column) leaves nothing to choose.
 */
export const CsvCheckStep = (props: CsvCheckStepProps) => {
  const { csvImport, rows, onClose } = props;

  if (csvImport.status !== "CHECKED") {
    return (
      <div className="flex flex-col gap-4">
        <LoadingState message="ファイルの内容を確認しています。このまま閉じても、履歴から確認できます。" />
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    );
  }
  if (csvImport.fileError !== null) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>このファイルは取り込めません</AlertTitle>
          <AlertDescription>{csvImport.fileError}</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    );
  }
  return rows ? (
    <CheckedRows {...props} rows={rows} />
  ) : (
    <CsvRowsTable rows={undefined} isLoading summary={props.summary} mode="check" />
  );
};

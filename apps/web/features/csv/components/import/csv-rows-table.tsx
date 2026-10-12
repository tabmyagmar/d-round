"use client";

import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTableRowSelection } from "@repo/ui/components/composed/data-table";
import { StatusBadge } from "@repo/ui/components/composed/status-badge";

import type { CsvImportRow } from "@/features/csv/types";
import { summaryLineOf } from "@/features/csv/utils/csv-type-content";
import type { CsvSummaryColumn } from "@/features/csv/utils/csv-type-content";

const helper = createDataTableColumns<CsvImportRow>();

/** 内容確認: whether the line can be imported (the legacy row badges 取込完了 / 取込不可). */
const CheckBadge = ({ row }: { row: CsvImportRow }) =>
  row.errors.length === 0 ? (
    <StatusBadge tone="success">取込完了</StatusBadge>
  ) : (
    <StatusBadge tone="danger">取込不可</StatusBadge>
  );

/** 結果: the line's result (legacy 送信完了 / 送信エラー); 未登録 when the import never reached it. */
const ResultBadge = ({ row }: { row: CsvImportRow }) => {
  if (row.result === "IMPORTED") {
    return <StatusBadge tone="success">送信完了</StatusBadge>;
  }
  return row.result === "FAILED" ? (
    <StatusBadge tone="danger">送信エラー</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">未登録</StatusBadge>
  );
};

const rowColumns = (summary: readonly CsvSummaryColumn[], mode: "check" | "result") =>
  helper.columns([
    helper.accessor("lineNumber", {
      header: "行",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{getValue()}</span>
      ),
    }),
    ...summary.map((column, index) =>
      helper.display({
        id: `summary-${String(index)}`,
        header: column.header,
        cell: ({ row }) => (
          <div className="flex flex-col text-sm leading-tight">
            {column.lines.map((keys, line) => (
              <span
                key={keys.join("-")}
                className={line === 0 ? "font-medium" : "text-xs text-muted-foreground"}
              >
                {summaryLineOf(row.original.data, keys) || (line === 0 ? "—" : null)}
              </span>
            ))}
          </div>
        ),
      }),
    ),
    helper.display({
      id: "notes",
      header: "説明欄",
      cell: ({ row }) => {
        const messages =
          mode === "check"
            ? row.original.errors
            : row.original.resultError === null
              ? []
              : [row.original.resultError];
        return (
          <ul className="flex max-w-80 flex-col gap-0.5 text-xs whitespace-pre-line text-destructive">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        );
      },
    }),
    helper.display({
      id: "status",
      header: "ステータス",
      cell: ({ row }) =>
        mode === "check" ? <CheckBadge row={row.original} /> : <ResultBadge row={row.original} />,
    }),
  ]);

export type CsvRowsTableProps = {
  rows: CsvImportRow[] | undefined;
  isLoading: boolean;
  /** The type's summary cells (`CSV_TYPE_CONTENT[type].summary`). */
  summary: readonly CsvSummaryColumn[];
  /** 内容確認 shows each line's check, 結果 its result. */
  mode: "check" | "result";
  /** 内容確認: lines without errors can be chosen for 確定. */
  rowSelection?: DataTableRowSelection<CsvImportRow>;
};

/**
 * The lines of an import (the legacy detail modals' table, one for every type): 行, the type's
 * summary cells, 説明欄 (the check's errors or the result's message) and ステータス.
 */
export const CsvRowsTable = ({
  rows,
  isLoading,
  summary,
  mode,
  rowSelection,
}: CsvRowsTableProps) => {
  const columns = useMemo(() => rowColumns(summary, mode), [summary, mode]);
  return (
    <DataTable
      title="取込データ"
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="取り込む行はありません"
      getRowId={(row) => String(row.lineNumber)}
      {...(rowSelection ? { rowSelection } : {})}
    />
  );
};

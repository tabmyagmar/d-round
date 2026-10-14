"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTableRowSelection } from "@repo/ui/components/composed/data-table";

import type { CsvImportRow } from "@/features/csv/types";
import { summaryLineOf } from "@/features/csv/utils/csv-type-content";
import type { CsvSummaryColumn } from "@/features/csv/utils/csv-type-content";

const helper = createDataTableColumns<CsvImportRow>();

/** What a step shows of a line beside its cells: its messages (説明欄) and its badge. */
export type CsvRowState = {
  notesOf: (row: CsvImportRow) => readonly string[];
  badgeOf: (row: CsvImportRow) => ReactNode;
};

const rowColumns = (summary: readonly CsvSummaryColumn[], { notesOf, badgeOf }: CsvRowState) =>
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
      cell: ({ row }) => (
        <ul className="flex max-w-80 min-w-48 flex-col gap-0.5 text-xs whitespace-pre-line text-destructive">
          {notesOf(row.original).map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ),
    }),
    helper.display({
      id: "status",
      header: "ステータス",
      cell: ({ row }) => badgeOf(row.original),
    }),
  ]);

export type CsvRowsTableProps = {
  rows: CsvImportRow[] | undefined;
  isLoading: boolean;
  /** The type's summary cells (`CSV_TYPE_CONTENT[type].summary`). */
  summary: readonly CsvSummaryColumn[];
  /** The step's 説明欄 and badge of a line; module-level, so the columns are built once. */
  state: CsvRowState;
  /** 内容確認: lines without errors can be chosen for 確定. */
  rowSelection?: DataTableRowSelection<CsvImportRow>;
};

/**
 * The lines of an import (the legacy detail modals' table, one for every type): 行, the type's
 * summary cells, 説明欄 and ステータス as the step says them.
 */
export const CsvRowsTable = ({
  rows,
  isLoading,
  summary,
  state,
  rowSelection,
}: CsvRowsTableProps) => {
  const columns = useMemo(() => rowColumns(summary, state), [summary, state]);
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

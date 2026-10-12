"use client";

import { useMemo } from "react";

import { Button } from "@repo/ui/components/button";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTablePagination } from "@repo/ui/components/composed/data-table";
import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import { formatDateTime } from "@repo/ui/components/form";

import type { CsvImportListItem } from "@/features/csv/types";
import { csvImportActionOf, csvImportStatusOf } from "@/features/csv/utils/csv-status";

const helper = createDataTableColumns<CsvImportListItem>();

/** The legacy `CsvUploadHistoryContent` columns; 登録 counts the lines imported. */
const historyColumns = (onOpen: (item: CsvImportListItem) => void) =>
  helper.columns([
    helper.display({
      id: "createdBy",
      header: "担当者情報",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.createdBy.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.createdBy.email}</span>
        </div>
      ),
    }),
    helper.display({
      id: "file",
      header: "ファイル名",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="max-w-64 truncate">{row.original.fileName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(row.original.createdAt, "ja-JP")}
          </span>
        </div>
      ),
    }),
    helper.display({
      id: "counts",
      header: "新規導入数",
      cell: ({ row }) => {
        const { totalCount, validCount, importedCount } = row.original;
        return (
          <div className="flex flex-col tabular-nums">
            <span>取込データ入数: {totalCount}</span>
            <span className="text-xs text-muted-foreground">
              取込可能: {validCount} / 取込不可: {totalCount - validCount} / 登録: {importedCount}
            </span>
          </div>
        );
      },
    }),
    helper.display({
      id: "status",
      header: "ステータス",
      cell: ({ row }) => {
        const { label, tone } = csvImportStatusOf(row.original);
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    }),
    helper.display({
      id: "action",
      header: "アクション",
      cell: ({ row }) => {
        const action = csvImportActionOf(row.original.status);
        return action ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpen(row.original);
            }}
          >
            {action}
          </Button>
        ) : null;
      },
    }),
  ]);

export type CsvHistoryTableProps = {
  title: string;
  data: CsvImportListItem[] | undefined;
  isLoading: boolean;
  pagination: DataTablePagination | undefined;
  /** 登録 / 確認: open the import at its step. */
  onOpen: (item: CsvImportListItem) => void;
};

/** 履歴 of one CSV type: the caller's own imports, newest first. */
export const CsvHistoryTable = ({
  title,
  data,
  isLoading,
  pagination,
  onOpen,
}: CsvHistoryTableProps) => {
  const columns = useMemo(() => historyColumns(onOpen), [onOpen]);
  return (
    <DataTable
      title={title}
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="取込の履歴はありません"
      getRowId={(item) => item.id}
      {...(pagination ? { pagination } : {})}
    />
  );
};

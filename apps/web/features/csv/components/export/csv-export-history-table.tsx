"use client";

import { Download } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@repo/ui/components/button";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTablePagination } from "@repo/ui/components/composed/data-table";
import { formatDateTime } from "@repo/ui/components/form";

import type { CsvExportListItem } from "@/features/csv/types";

const helper = createDataTableColumns<CsvExportListItem>();

/** The legacy `CsvDownloadHistoryContent` columns. */
const exportColumns = (
  downloadingId: string | null,
  onDownload: (item: CsvExportListItem) => void,
) =>
  helper.columns([
    helper.accessor("createdAt", {
      header: "ダウンロード日付",
      cell: ({ getValue }) => (
        <span className="tabular-nums">{formatDateTime(getValue(), "ja-JP")}</span>
      ),
    }),
    helper.display({
      id: "name",
      header: "担当者名",
      cell: ({ row }) => row.original.createdBy.name,
    }),
    helper.display({
      id: "email",
      header: "メールアドレス",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.createdBy.email}</span>
      ),
    }),
    helper.accessor("fileName", { header: "タイトル" }),
    helper.accessor("rowCount", {
      header: "人数",
      cell: ({ getValue }) => <span className="tabular-nums">({getValue()})</span>,
    }),
    helper.display({
      id: "download",
      header: "操作",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          disabled={downloadingId === row.original.id}
          onClick={() => {
            onDownload(row.original);
          }}
        >
          <Download data-icon="inline-start" />
          ダウンロード
        </Button>
      ),
    }),
  ]);

export type CsvExportHistoryTableProps = {
  data: CsvExportListItem[] | undefined;
  isLoading: boolean;
  pagination: DataTablePagination | undefined;
  /** The file whose new URL is being asked for. */
  downloadingId: string | null;
  /** ダウンロード: asks for a new signed URL of the stored file (they last 15 minutes). */
  onDownload: (item: CsvExportListItem) => void;
};

/** The caller's downloads of one type, newest first, each downloadable again. */
export const CsvExportHistoryTable = ({
  data,
  isLoading,
  pagination,
  downloadingId,
  onDownload,
}: CsvExportHistoryTableProps) => {
  const columns = useMemo(
    () => exportColumns(downloadingId, onDownload),
    [downloadingId, onDownload],
  );
  return (
    <DataTable
      title="CSVダウンロード数"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="ダウンロードの履歴はありません"
      getRowId={(item) => item.id}
      {...(pagination ? { pagination } : {})}
    />
  );
};

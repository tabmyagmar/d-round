"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";

import { CsvExportHistoryTable } from "@/features/csv/components/export/csv-export-history-table";
import type { CsvEntity } from "@/features/csv/types";
import { CSV_ENTITIES } from "@/features/csv/utils/csv-entities";
import { paginationOf } from "@/hooks/use-table-state";
import { downloadFromUrl } from "@/lib/download";
import { useTRPC } from "@/lib/trpc/react";

const PER_PAGE = 10;

/**
 * ダウンロード履歴 (legacy `CsvDownloadHistoryDialog`): the caller's own downloads of the list's
 * type; ダウンロード asks for a new signed URL of the stored workbook each time.
 */
export const CsvExportHistoryDialog = ({
  entity,
  onOpenChange,
}: {
  entity: CsvEntity;
  onOpenChange: (open: boolean) => void;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { exportType } = CSV_ENTITIES[entity];
  const [page, setPage] = useState(1);
  const exports = useQuery(
    trpc.csvExport.list.queryOptions(
      { type: exportType, page, perPage: PER_PAGE },
      { placeholderData: keepPreviousData },
    ),
  );
  const download = useMutation({
    mutationFn: (csvExportId: string) =>
      queryClient.query(trpc.csvExport.downloadUrl.queryOptions({ csvExportId }, { staleTime: 0 })),
    onSuccess: (file) => {
      downloadFromUrl(file.url);
    },
  });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="CSVダウンロード履歴"
      className="sm:max-w-4xl"
    >
      {exports.isError ? (
        <Alert variant="destructive">
          <AlertTitle>履歴を読み込めませんでした</AlertTitle>
          <AlertDescription>{exports.error.message}</AlertDescription>
        </Alert>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <CsvExportHistoryTable
            data={exports.data?.items}
            isLoading={exports.isPending}
            pagination={exports.data ? paginationOf(exports.data, setPage) : undefined}
            downloadingId={download.isPending ? download.variables : null}
            onDownload={(item) => {
              download.mutate(item.id);
            }}
          />
        </div>
      )}
    </ResponsiveDialog>
  );
};

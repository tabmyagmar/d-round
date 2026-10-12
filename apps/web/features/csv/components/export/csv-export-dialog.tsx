"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";

import { CsvExportForm } from "@/features/csv/components/export/csv-export-form";
import type { CsvEntity } from "@/features/csv/types";
import { CSV_ENTITIES } from "@/features/csv/utils/csv-entities";
import { CSV_EXPORT_CONTENT } from "@/features/csv/utils/csv-export-content";
import { downloadFromUrl } from "@/lib/download";
import { useTRPC } from "@/lib/trpc/react";

export type CsvExportDialogProps = {
  entity: CsvEntity;
  /** The rows ticked in the list (its row selection). */
  ids: readonly string[];
  onOpenChange: (open: boolean) => void;
  /** 履歴: the menu shows the download history instead. */
  onShowHistory: () => void;
};

/**
 * ダウンロード (legacy `CsvDownloadDialog`): the ticked rows with the columns picked, written by
 * the API as an xlsx (D15) and kept for 履歴; the browser saves it from its signed URL.
 */
export const CsvExportDialog = ({
  entity,
  ids,
  onOpenChange,
  onShowHistory,
}: CsvExportDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { label, exportType } = CSV_ENTITIES[entity];
  const content = CSV_EXPORT_CONTENT[exportType];

  const create = useMutation(
    trpc.csvExport.create.mutationOptions({
      onSuccess: async (file) => {
        downloadFromUrl(file.url);
        onOpenChange(false);
        await queryClient.invalidateQueries(trpc.csvExport.list.pathFilter());
      },
    }),
  );

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={content.title}
      className="sm:max-w-xl"
    >
      <CsvExportForm
        label={label}
        selectedCount={ids.length}
        groups={content.groups}
        initial={content.initial}
        pending={create.isPending}
        onSubmit={(values) => {
          create.mutate(content.inputOf([...ids], values));
        }}
        onShowHistory={onShowHistory}
      />
    </ResponsiveDialog>
  );
};

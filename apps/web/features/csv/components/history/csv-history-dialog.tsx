"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";
import type { CsvImportType } from "@repo/validation";

import { CsvHistoryTable } from "@/features/csv/components/history/csv-history-table";
import type { CsvEntity } from "@/features/csv/types";
import { CSV_ENTITIES } from "@/features/csv/utils/csv-entities";
import { CSV_POLL_INTERVAL_MS, isCsvImportWorking } from "@/features/csv/utils/csv-status";
import { CSV_TYPE_CONTENT } from "@/features/csv/utils/csv-type-content";
import { paginationOf } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

const PER_PAGE = 10;

export type CsvHistoryDialogProps = {
  entity: CsvEntity;
  /** The list shown first: back from an import, its type's; otherwise 追加. */
  initialType?: CsvImportType;
  onOpenChange: (open: boolean) => void;
  /** A row's 登録 / 確認: the menu opens the import dialog at the import. */
  onOpenImport: (type: CsvImportType, csvImportId: string) => void;
};

/**
 * 履歴 (legacy `CsvUploadHistoryContent`, then reached from each upload dialog): the caller's own
 * imports of the list's 追加 or 更新, ten a page, polled while one of them is still being worked
 * on, so 確認中 turns into 確認完了 without a reload.
 */
export const CsvHistoryDialog = ({
  entity,
  initialType,
  onOpenChange,
  onOpenImport,
}: CsvHistoryDialogProps) => {
  const trpc = useTRPC();
  const { label, createType, updateType } = CSV_ENTITIES[entity];
  const [type, setType] = useState<CsvImportType>(initialType ?? createType);
  const [page, setPage] = useState(1);
  const imports = useQuery(
    trpc.csvImport.list.queryOptions(
      { type, page, perPage: PER_PAGE },
      {
        placeholderData: keepPreviousData,
        refetchInterval: (query) =>
          query.state.data?.items.some((item) => isCsvImportWorking(item.status))
            ? CSV_POLL_INTERVAL_MS
            : false,
      },
    ),
  );

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="CSVインポート履歴"
      className="sm:max-w-5xl"
    >
      <div role="group" aria-label="取込の種類" className="flex gap-2">
        {[
          { value: createType, text: `${label}追加` },
          { value: updateType, text: `${label}更新` },
        ].map((option) => (
          <Button
            key={option.value}
            variant={option.value === type ? "default" : "outline"}
            size="sm"
            aria-pressed={option.value === type}
            onClick={() => {
              setType(option.value);
              setPage(1);
            }}
          >
            {option.text}
          </Button>
        ))}
      </div>
      {imports.isError ? (
        <Alert variant="destructive">
          <AlertTitle>履歴を読み込めませんでした</AlertTitle>
          <AlertDescription>{imports.error.message}</AlertDescription>
        </Alert>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <CsvHistoryTable
            title={CSV_TYPE_CONTENT[type].historyTitle}
            data={imports.data?.items}
            isLoading={imports.isPending}
            pagination={imports.data ? paginationOf(imports.data, setPage) : undefined}
            onOpen={(item) => {
              onOpenImport(item.type, item.id);
            }}
          />
        </div>
      )}
    </ResponsiveDialog>
  );
};

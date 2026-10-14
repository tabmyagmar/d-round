"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";
import { Stepper } from "@repo/ui/components/composed/stepper";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { CsvImportType } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { CsvCheckStep } from "@/features/csv/components/import/csv-check-step";
import { CsvFileStep } from "@/features/csv/components/import/csv-file-step";
import { CsvProgressStep } from "@/features/csv/components/import/csv-progress-step";
import { CsvResultStep } from "@/features/csv/components/import/csv-result-step";
import type { CsvEntity } from "@/features/csv/types";
import { checkCsvFile, csvLookupsOf } from "@/features/csv/utils/csv-file-check";
import {
  CSV_IMPORT_STEPS,
  CSV_POLL_INTERVAL_MS,
  csvImportStepOf,
  isCsvImportWorking,
} from "@/features/csv/utils/csv-status";
import { CSV_TYPE_CONTENT } from "@/features/csv/utils/csv-type-content";
import { useAttachmentUpload } from "@/hooks/use-attachment-upload";
import { saveTextFile } from "@/lib/download";
import { useTRPC } from "@/lib/trpc/react";

export type CsvImportDialogProps = {
  /** The list the menu belongs to: it is read again once lines were written. */
  entity: CsvEntity;
  type: CsvImportType;
  /** An import opened from 履歴, at its step; without one the dialog starts at ファイル選択. */
  csvImportId?: string;
  onOpenChange: (open: boolean) => void;
};

/**
 * {label}を追加 / 更新 (D13): one dialog for every type, whose step follows the import's status —
 * polled every 2 s while the worker has it (D10) — instead of the legacy "come back in five
 * minutes". Owns the import's queries and mutations; the steps are presentational.
 */
export const CsvImportDialog = ({
  entity,
  type,
  csvImportId: openedId,
  onOpenChange,
}: CsvImportDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const content = CSV_TYPE_CONTENT[type];
  const [csvImportId, setCsvImportId] = useState<string | null>(openedId ?? null);
  const id = csvImportId ?? "";

  const csvImport = useQuery(
    trpc.csvImport.byId.queryOptions(
      { csvImportId: id },
      {
        enabled: csvImportId !== null,
        refetchInterval: (query) =>
          isCsvImportWorking(query.state.data?.status) ? CSV_POLL_INTERVAL_MS : false,
      },
    ),
  );
  const status = csvImport.data?.status;
  const rows = useQuery(
    trpc.csvImport.rows.queryOptions(
      { csvImportId: id },
      { enabled: status === "CHECKED" || status === "IMPORTED" || status === "FAILED" },
    ),
  );

  // The file step's check turns 地域 / 都道府県 names into codes, as the worker's does.
  const hierarchy = useSourceHierarchy(csvImportId === null);
  const upload = useAttachmentUpload("CSV_IMPORT");
  const create = useMutation(
    trpc.csvImport.create.mutationOptions({
      onSuccess: async (created) => {
        queryClient.setQueryData(
          trpc.csvImport.byId.queryKey({ csvImportId: created.id }),
          created,
        );
        setCsvImportId(created.id);
        await queryClient.invalidateQueries(trpc.csvImport.list.pathFilter());
      },
    }),
  );
  const confirm = useMutation(
    trpc.csvImport.confirm.mutationOptions({
      onSuccess: async (confirmed) => {
        // The lines read at the check would stand in for their results: they are read again.
        queryClient.removeQueries({ queryKey: trpc.csvImport.rows.queryKey({ csvImportId: id }) });
        queryClient.setQueryData(trpc.csvImport.byId.queryKey({ csvImportId: id }), confirmed);
        await queryClient.invalidateQueries(trpc.csvImport.list.pathFilter());
      },
    }),
  );
  const errorCsv = useMutation({
    mutationFn: () =>
      queryClient.query(
        trpc.csvImport.errorCsv.queryOptions({ csvImportId: id }, { staleTime: 0 }),
      ),
    onSuccess: (file) => {
      saveTextFile(file.text, file.fileName);
    },
  });

  const close = () => {
    if (isCsvImportWorking(status)) {
      toast.info(
        status === "CONFIRMED" || status === "IMPORTING"
          ? "登録中です。履歴から確認できます"
          : "確認中です。履歴から確認できます",
      );
    }
    if (status === "IMPORTED" || status === "FAILED") {
      // Lines were written: the list behind the dialog and its details are read again.
      const written = {
        user: trpc.user.pathFilter(),
        staff: trpc.staff.pathFilter(),
        client: trpc.client.pathFilter(),
        branch: trpc.branch.pathFilter(),
      }[entity];
      void queryClient.invalidateQueries(written);
    }
    onOpenChange(false);
  };

  const body = () => {
    if (csvImportId === null) {
      return hierarchy.ready ? (
        <CsvFileStep
          check={async (file) =>
            checkCsvFile(
              new Uint8Array(await file.arrayBuffer()),
              content.definition,
              csvLookupsOf(hierarchy),
            )
          }
          upload={upload}
          templatePath={content.templatePath}
          manualPath={content.manualPath}
          pending={create.isPending}
          onSubmit={(attachmentId) => {
            create.mutate({ type, attachmentId });
          }}
          onCancel={close}
        />
      ) : (
        <Skeleton className="h-48 w-full" />
      );
    }
    if (csvImport.isError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>取込を読み込めませんでした</AlertTitle>
          <AlertDescription>{csvImport.error.message}</AlertDescription>
        </Alert>
      );
    }
    if (!csvImport.data) {
      return <Skeleton className="h-48 w-full" />;
    }
    const step = csvImportStepOf(csvImport.data.status);
    if (step === 1) {
      return (
        <CsvCheckStep
          csvImport={csvImport.data}
          rows={rows.data}
          summary={content.summary}
          pending={confirm.isPending}
          downloading={errorCsv.isPending}
          onConfirm={(lineNumbers) => {
            confirm.mutate({ csvImportId: id, lineNumbers });
          }}
          onDownloadErrors={() => {
            errorCsv.mutate();
          }}
          onClose={close}
        />
      );
    }
    return step === 2 ? (
      <CsvProgressStep csvImport={csvImport.data} onClose={close} />
    ) : (
      <CsvResultStep
        csvImport={csvImport.data}
        rows={rows.data}
        summary={content.summary}
        downloading={errorCsv.isPending}
        onDownloadErrors={() => {
          errorCsv.mutate();
        }}
        onClose={close}
      />
    );
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      title={content.title}
      // ファイル選択 as before; the lines from 内容確認 on get the room the 就業先部署 table needs to
      // show its 説明欄 and ステータス without scrolling on a 1280 px screen.
      className={csvImportId === null ? "sm:max-w-5xl" : "sm:max-w-[min(80rem,calc(100%-2rem))]"}
    >
      <Stepper
        steps={CSV_IMPORT_STEPS}
        current={
          csvImportId === null || !csvImport.data ? 0 : csvImportStepOf(csvImport.data.status)
        }
        label="CSV取込の手順"
      />
      {body()}
    </ResponsiveDialog>
  );
};

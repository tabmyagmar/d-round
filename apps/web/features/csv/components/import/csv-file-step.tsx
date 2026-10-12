"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import { FileField, FormActions } from "@repo/ui/components/form";
import type { FileFieldValue } from "@repo/ui/components/form";
import { ATTACHMENT_RULES, CSV_MAX_ROWS, attachmentAccept } from "@repo/validation";

import type { CsvFileCheck, CsvLineError } from "@/features/csv/utils/csv-file-check";

const helper = createDataTableColumns<CsvLineError>();

/** The legacy `CsvUploadError` columns. */
const LINE_ERROR_COLUMNS = helper.columns([
  helper.accessor("lineNumber", {
    header: "CSVファイル内の行",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground tabular-nums">行: {getValue()}</span>
    ),
  }),
  helper.accessor("errors", {
    header: "エラーの詳細",
    cell: ({ getValue }) => (
      <ul className="flex flex-col gap-0.5 text-xs text-destructive">
        {getValue().map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    ),
  }),
]);

/** The legacy guide under the drop zone, its 150 people now 150 rows of any type. */
const GUIDE = `フォーマット上の必須項目は漏れなく入力してください。その他の項目は追加後に更新可能です。インポート機能を利用すると一度に最大${String(CSV_MAX_ROWS)}件のデータを取り込めます。それ以上の場合は複数のファイルに分けて作業を行ってください。`;

export type CsvFileStepProps = {
  /** The browser's format check of a picked file (`checkCsvFile`). */
  check: (file: File) => Promise<CsvFileCheck>;
  /** Uploads a file the check passed (`useAttachmentUpload("CSV_IMPORT")`). */
  upload: (file: File) => Promise<{ id: string }>;
  templatePath: string;
  manualPath: string;
  /** The import is being started. */
  pending: boolean;
  /** アップロード: starts the import of the uploaded file. */
  onSubmit: (attachmentId: string) => void;
  onCancel: () => void;
};

/**
 * ファイル選択 (legacy `CsvUploadContent`): a picked file is checked in the browser first; one with
 * format errors is not uploaded, and its lines and messages are listed instead (the legacy showed
 * the same table behind 「CSVエラーを表示」). A clean file is uploaded at once; アップロード starts
 * the import, whose check the worker runs on the stored file.
 */
export const CsvFileStep = ({
  check,
  upload,
  templatePath,
  manualPath,
  pending,
  onSubmit,
  onCancel,
}: CsvFileStepProps) => {
  const form = useForm<{ file: FileFieldValue[] }>({ defaultValues: { file: [] } });
  const files = useWatch({ control: form.control, name: "file" });
  const [lineErrors, setLineErrors] = useState<CsvLineError[]>([]);
  const attachmentId = files[0]?.id;

  const checkThenUpload = async (file: File) => {
    setLineErrors([]);
    const found = await check(file);
    if (found.fileError !== null) {
      throw new Error(found.fileError);
    }
    if (found.lineErrors.length > 0) {
      setLineErrors(found.lineErrors);
      throw new Error(`CSVエラーが ${String(found.lineErrors.length)} 件あります`);
    }
    return upload(file);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (attachmentId) {
          onSubmit(attachmentId);
        }
      }}
    >
      <FileField
        control={form.control}
        name="file"
        label="CSVファイル"
        accept={attachmentAccept("CSV_IMPORT")}
        maxSize={ATTACHMENT_RULES.CSV_IMPORT.maxBytes}
        upload={checkThenUpload}
        dropLabel="ファイルをアップロードする場合は、こちらをクリックまたはドラッグしてください。"
        disabled={pending}
      />
      {lineErrors.length > 0 ? (
        <DataTable
          title="CSVアップロードエラーリスト"
          columns={LINE_ERROR_COLUMNS}
          data={lineErrors}
          getRowId={(line) => String(line.lineNumber)}
          className="max-h-72 overflow-y-auto"
        />
      ) : null}
      <p className="text-sm leading-relaxed text-muted-foreground">{GUIDE}</p>
      <div className="flex flex-col items-start gap-1 text-sm">
        <a href={templatePath} download className="text-primary hover:underline">
          CSVデータフォーマット
        </a>
        <a
          href={manualPath}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          CSVデータ説明書
        </a>
      </div>
      <FormActions
        className="*:flex-1"
        submitLabel="アップロード"
        pendingLabel="アップロード中…"
        pending={pending}
        disabled={!attachmentId}
      >
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
      </FormActions>
    </form>
  );
};

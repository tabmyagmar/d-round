"use client";

import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTablePagination } from "@repo/ui/components/composed/data-table";
import { formatDate } from "@repo/ui/components/form";

import { CommentTemplateRowActions } from "@/features/comment-templates/components/comment-template-row-actions";
import type { CommentTemplateRow } from "@/features/comment-templates/types";
import { typesLabel } from "@/features/comment-templates/utils/comment-template-labels";
import { useRowSelection } from "@/stores/row-selection";

const helper = createDataTableColumns<CommentTemplateRow>();

/** The legacy 定型文管理 columns: 使用先メニュー, タイトル, 作成日, then the row's menu. */
const templateColumns = (
  onEdit: (template: CommentTemplateRow) => void,
  onDelete: (template: CommentTemplateRow) => void,
) =>
  helper.columns([
    helper.accessor("types", {
      header: "使用先メニュー",
      cell: ({ getValue }) => <span className="font-medium">{typesLabel(getValue())}</span>,
    }),
    helper.accessor("short", {
      header: "タイトル",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    helper.accessor("createdAt", {
      header: "作成日", // YYYY/MM/DD, as the legacy list
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{formatDate(getValue(), "ja-JP")}</span>
      ),
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <CommentTemplateRowActions template={row.original} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ),
    }),
  ]);

/** Module-level so the selection column is built once, not on every render. */
const SELECTION_LABELS = {
  all: "このページの定型文をすべて選択",
  row: (template: CommentTemplateRow) => `${template.short}を選択`,
};

export type CommentTemplatesTableProps = {
  data: CommentTemplateRow[] | undefined;
  isLoading: boolean;
  pagination: DataTablePagination | undefined;
  onEdit: (template: CommentTemplateRow) => void;
  onDelete: (template: CommentTemplateRow) => void;
};

export const CommentTemplatesTable = ({
  data,
  isLoading,
  pagination,
  onEdit,
  onDelete,
}: CommentTemplatesTableProps) => {
  const columns = useMemo(() => templateColumns(onEdit, onDelete), [onEdit, onDelete]);
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  return (
    <DataTable
      title="全定型文数"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="定型文はまだありません"
      getRowId={(row) => row.id}
      rowSelection={{ state: rowSelection, onChange: setRowSelection, labels: SELECTION_LABELS }}
      {...(pagination ? { pagination } : {})}
    />
  );
};

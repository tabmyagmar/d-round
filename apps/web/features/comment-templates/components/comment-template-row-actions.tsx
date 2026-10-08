"use client";

import { FilePen, Trash2 } from "lucide-react";

import { RowActions } from "@repo/ui/components/composed/row-actions";

import type { CommentTemplateRow } from "@/features/comment-templates/types";

export type CommentTemplateRowActionsProps = {
  template: CommentTemplateRow;
  onEdit: (template: CommentTemplateRow) => void;
  onDelete: (template: CommentTemplateRow) => void;
};

/** 定型文編集 / 定型文削除. The list holds only the caller's own templates, so both always apply. */
export const CommentTemplateRowActions = ({
  template,
  onEdit,
  onDelete,
}: CommentTemplateRowActionsProps) => (
  <RowActions
    label={`${template.short}の操作`}
    actions={[
      {
        key: "edit",
        label: "定型文編集",
        icon: <FilePen />,
        onSelect: () => {
          onEdit(template);
        },
      },
      {
        key: "delete",
        label: "定型文削除",
        icon: <Trash2 />,
        destructive: true,
        onSelect: () => {
          onDelete(template);
        },
      },
    ]}
  />
);

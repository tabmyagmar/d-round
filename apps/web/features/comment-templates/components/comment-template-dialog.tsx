"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ContentDialog } from "@repo/ui/components/composed/content-dialog";

import { CommentTemplateCreateForm } from "@/features/comment-templates/components/comment-template-create-form";
import { CommentTemplateUpdateForm } from "@/features/comment-templates/components/comment-template-update-form";
import type { CommentTemplateRow } from "@/features/comment-templates/types";
import { useTRPC } from "@/lib/trpc/react";

/** What the dialog was opened for: a new template, or one row to edit. */
export type CommentTemplateDialogTarget =
  { mode: "create" } | { mode: "edit"; template: CommentTemplateRow };

/** The API's message, or the legacy Japanese one for a title the user already has. */
const messageOf = (error: {
  message: string;
  data?: { code: string } | null | undefined;
}): string => (error.data?.code === "CONFLICT" ? "同じタイトルの定型文があります" : error.message);

/**
 * テンプレート作成 / テンプレート編集 (the legacy modal): owns the mutation, the toast and the
 * list refresh; the forms are presentational. Rendered only while it has a target.
 */
export const CommentTemplateDialog = ({
  target,
  onOpenChange,
}: {
  target: CommentTemplateDialogTarget;
  onOpenChange: (open: boolean) => void;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const settle = async (message: string) => {
    toast.success(message);
    onOpenChange(false);
    await queryClient.invalidateQueries(trpc.commentTemplate.pathFilter());
  };

  const create = useMutation(
    trpc.commentTemplate.create.mutationOptions({
      onSuccess: () => settle("テンプレートを作成しました"),
      onError: (error) => {
        toast.error(messageOf(error));
      },
    }),
  );
  const update = useMutation(
    trpc.commentTemplate.update.mutationOptions({
      onSuccess: () => settle("テンプレートを更新しました"),
      onError: (error) => {
        toast.error(messageOf(error));
      },
    }),
  );
  const close = () => {
    onOpenChange(false);
  };

  return (
    <ContentDialog
      open
      onOpenChange={onOpenChange}
      title={target.mode === "edit" ? "テンプレート編集" : "テンプレート作成"}
      className="sm:max-w-md"
    >
      {target.mode === "edit" ? (
        <CommentTemplateUpdateForm
          template={target.template}
          pending={update.isPending}
          onSubmit={(input) => {
            update.mutate(input);
          }}
          onCancel={close}
        />
      ) : (
        <CommentTemplateCreateForm
          pending={create.isPending}
          onSubmit={(input) => {
            create.mutate(input);
          }}
          onCancel={close}
        />
      )}
    </ContentDialog>
  );
};

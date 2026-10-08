"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";

import { useTRPC } from "@/lib/trpc/react";
import { useRowSelection } from "@/stores/row-selection";

export type CommentTemplateDeleteDialogProps = {
  /** One row's id (its menu) or the selection (the toolbar's 削除). */
  ids: readonly string[];
  onOpenChange: (open: boolean) => void;
};

/**
 * 定型文を削除しますか？ — the legacy confirmation, for one template or several. Rendered inside the
 * list's store: the deleted templates leave the selection.
 */
export const CommentTemplateDeleteDialog = ({
  ids,
  onOpenChange,
}: CommentTemplateDeleteDialogProps) => {
  const trpc = useTRPC();
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  const queryClient = useQueryClient();

  const remove = useMutation(
    trpc.commentTemplate.deleteMany.mutationOptions({
      onSuccess: async () => {
        toast.success("定型文が削除されました");
        onOpenChange(false);
        setRowSelection((selection) =>
          Object.fromEntries(Object.entries(selection).filter(([id]) => !ids.includes(id))),
        );
        await queryClient.invalidateQueries(trpc.commentTemplate.pathFilter());
      },
      onError: () => {
        toast.error("定型文を削除できませんでした");
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="定型文を削除しますか？"
      confirmLabel="削除"
      cancelLabel="キャンセル"
      pendingLabel="削除中…"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate({ commentTemplateIds: [...ids] });
      }}
    />
  );
};

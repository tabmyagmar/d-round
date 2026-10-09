"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";

import { useTRPC } from "@/lib/trpc/react";

/**
 * The legacy messages for the API's refusals (its "too many" said クライアント; it means 就業先部署
 * here); anything else is a plain failure.
 */
const DELETE_ERRORS: Partial<Record<string, string>> = {
  CONFLICT: "選択した就業先部署は削除できません",
  BAD_REQUEST: "一度に削除できる就業先部署の数を超えています",
};

export type BranchDeleteDialogProps = {
  /** One row's id (its menu) or the list's selection (the toolbar's 削除). */
  ids: readonly string[];
  onOpenChange: (open: boolean) => void;
  /** After the delete (the dialog has already asked to close): the list unselects. */
  onDeleted: (ids: readonly string[]) => void;
};

/**
 * 就業先部署削除 (`branch.deleteMany`), allowed for 停止 branches only (the legacy deleted any
 * branch for good); the legacy row menu and toolbar both asked 就業先部署を削除しますか？
 */
export const BranchDeleteDialog = ({ ids, onOpenChange, onDeleted }: BranchDeleteDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const remove = useMutation(
    trpc.branch.deleteMany.mutationOptions({
      onSuccess: async () => {
        toast.success("就業先部署を削除しました");
        onOpenChange(false);
        onDeleted(ids);
        await queryClient.invalidateQueries(trpc.branch.pathFilter());
      },
      onError: (error) => {
        toast.error(DELETE_ERRORS[error.data?.code ?? ""] ?? "就業先部署を削除できませんでした");
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="就業先部署を削除しますか？"
      confirmLabel="削除"
      cancelLabel="キャンセル"
      pendingLabel="削除中…"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate({ branchIds: [...ids] });
      }}
    />
  );
};

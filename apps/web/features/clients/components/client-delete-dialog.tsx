"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";

import { useTRPC } from "@/lib/trpc/react";

/** The legacy messages for the API's refusals; anything else is the global error toast. */
const DELETE_ERRORS: Partial<Record<string, string>> = {
  CONFLICT: "選択されたクライアントは削除できません",
  BAD_REQUEST: "一度に削除できるクライアントの数を超えています",
};

export type ClientDeleteDialogProps = {
  /** One row's id (its menu) or the list's selection (the toolbar's 削除). */
  ids: readonly string[];
  onOpenChange: (open: boolean) => void;
  /** After the delete (the dialog has already asked to close): the list unselects. */
  onDeleted: (ids: readonly string[]) => void;
};

/**
 * クライアント削除 (`client.deleteMany`), allowed for 停止 clients only; the legacy row menu and
 * toolbar both asked クライアントを削除しますか？
 */
export const ClientDeleteDialog = ({ ids, onOpenChange, onDeleted }: ClientDeleteDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const remove = useMutation(
    trpc.client.deleteMany.mutationOptions({
      onSuccess: async () => {
        toast.success("クライアントを削除しました");
        onOpenChange(false);
        onDeleted(ids);
        await queryClient.invalidateQueries(trpc.client.pathFilter());
      },
      onError: (error) => {
        toast.error(DELETE_ERRORS[error.data?.code ?? ""] ?? "クライアントを削除できませんでした");
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="クライアントを削除しますか？"
      confirmLabel="削除"
      cancelLabel="キャンセル"
      pendingLabel="削除中…"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate({ clientIds: [...ids] });
      }}
    />
  );
};

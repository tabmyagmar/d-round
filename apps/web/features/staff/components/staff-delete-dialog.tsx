"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";
import { STAFF_DELETE_MAX } from "@repo/validation";

import { useTRPC } from "@/lib/trpc/react";

/** What the API's refusals mean on this screen; anything else is a plain failure. */
const DELETE_ERRORS: Partial<Record<string, string>> = {
  CONFLICT: "停止中のスタッフのみ削除できます",
  BAD_REQUEST: `一度に削除できるのは${STAFF_DELETE_MAX}件までです`,
};

export type StaffDeleteDialogProps = {
  /** One row's id (its menu, the detail page) or the list's selection (the toolbar's 削除). */
  ids: readonly string[];
  onOpenChange: (open: boolean) => void;
  /** After the delete (the dialog has already asked to close): the list unselects, the detail leaves. */
  onDeleted: (ids: readonly string[]) => void;
};

/**
 * スタッフ削除 (`staff.deleteMany`), allowed for 停止 staff only: the legacy row menu asked
 * スタッフを削除しますか？, the toolbar スタッフを削除してもよろしいですか？ for the selection.
 */
export const StaffDeleteDialog = ({ ids, onOpenChange, onDeleted }: StaffDeleteDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const remove = useMutation(
    trpc.staff.deleteMany.mutationOptions({
      onSuccess: async () => {
        toast.success("スタッフが削除されました");
        onOpenChange(false);
        onDeleted(ids);
        await queryClient.invalidateQueries(trpc.staff.pathFilter());
      },
      onError: (error) => {
        toast.error(DELETE_ERRORS[error.data?.code ?? ""] ?? "スタッフを削除できませんでした");
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={ids.length === 1 ? "スタッフを削除しますか？" : "スタッフを削除してもよろしいですか？"}
      confirmLabel="削除"
      cancelLabel="キャンセル"
      pendingLabel="削除中…"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate({ staffIds: [...ids] });
      }}
    />
  );
};

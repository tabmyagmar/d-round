"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";

import { userStatusOf } from "@/features/users/utils/user-labels";
import { useTRPC } from "@/lib/trpc/react";

export type UserStatusTarget = { id: string; name: string; deletedAt: Date | null };

export type UserStatusDialogProps = {
  /** The user to stop or resume; `null` closes the dialog. */
  user: UserStatusTarget | null;
  onOpenChange: (open: boolean) => void;
  /** After the change succeeded (the dialog has already asked to close). */
  onDone?: (status: "deactivated" | "active") => void;
};

/**
 * Confirms and applies 利用停止 (`user.deactivate`) or 利用再開 (`user.reactivate`), whichever the
 * user's current status calls for. One dialog per screen, opened for the chosen user.
 */
export const UserStatusDialog = ({ user, onOpenChange, onDone }: UserStatusDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const settle = async (status: "deactivated" | "active", message: string) => {
    toast.success(message);
    onOpenChange(false);
    onDone?.(status);
    await queryClient.invalidateQueries(trpc.user.pathFilter());
  };

  const deactivate = useMutation(
    trpc.user.deactivate.mutationOptions({
      onSuccess: () => settle("deactivated", "利用を停止しました"),
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );
  const reactivate = useMutation(
    trpc.user.reactivate.mutationOptions({
      onSuccess: () => settle("active", "利用を再開しました"),
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  if (!user) {
    return null;
  }
  const active = userStatusOf(user) === "active";

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={
        active ? `${user.name}さんの利用を停止しますか？` : `${user.name}さんの利用を再開しますか？`
      }
      description={
        active
          ? "すぐにログアウトされ、以後ログインできなくなります。アカウントは記録として残ります。"
          : "再びログインできるようになります。"
      }
      confirmLabel={active ? "停止" : "再開"}
      cancelLabel="キャンセル"
      destructive={active}
      pending={deactivate.isPending || reactivate.isPending}
      onConfirm={() => {
        (active ? deactivate : reactivate).mutate({ userId: user.id });
      }}
    />
  );
};

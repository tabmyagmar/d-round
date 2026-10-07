"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";

import { useTRPC } from "@/lib/trpc/react";

export type PasswordMailDialogProps = {
  /** The recipient; `null` closes the dialog. */
  user: { id: string; name: string; email: string } | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirms and sends the password mail (`user.sendPasswordReset`): the invitation while the user
 * has no password, a reset link afterwards. The link is valid for one hour.
 */
export const PasswordMailDialog = ({ user, onOpenChange }: PasswordMailDialogProps) => {
  const trpc = useTRPC();
  const send = useMutation(
    trpc.user.sendPasswordReset.mutationOptions({
      onSuccess: () => {
        toast.success("パスワード設定メールを送信しました");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  if (!user) {
    return null;
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`${user.name}さんにパスワード設定メールを送信しますか？`}
      description={`${user.email} 宛に送信します。パスワード未設定の担当者には登録案内を、設定済みの担当者には再設定のURLを送ります（有効期限1時間）。`}
      confirmLabel="送信"
      cancelLabel="キャンセル"
      pendingLabel="送信中…"
      pending={send.isPending}
      onConfirm={() => {
        send.mutate({ userId: user.id });
      }}
    />
  );
};

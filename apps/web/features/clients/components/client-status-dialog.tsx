"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";
import { OptionSelect } from "@repo/ui/components/composed/option-select";

import type { ClientRow } from "@/features/clients/types";
import { GENERAL_STATUS_OPTIONS } from "@/lib/general-status-labels";
import { useTRPC } from "@/lib/trpc/react";

export type ClientStatusTarget = Pick<ClientRow, "id" | "name" | "status">;

export type ClientStatusDialogProps = {
  client: ClientStatusTarget;
  onOpenChange: (open: boolean) => void;
};

/**
 * ステータス変更 (`client.changeStatus`): the legacy confirmation with the status to change to. The
 * legacy list changed it in a select inside the row and then asked; here the row menu opens this
 * dialog, which holds the select, as the staff list's.
 */
export const ClientStatusDialog = ({ client, onOpenChange }: ClientStatusDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(client.status);

  const change = useMutation(
    trpc.client.changeStatus.mutationOptions({
      onSuccess: async () => {
        toast.success("ステータスが変更されました");
        onOpenChange(false);
        await queryClient.invalidateQueries(trpc.client.pathFilter());
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`${client.name}のステータス変更`}
      description="該当クライアントのステータスを変更いたします。変更してよろしいでしょうか。"
      confirmLabel="変更"
      cancelLabel="キャンセル"
      pendingLabel="変更中…"
      destructive={status === "SUSPENDED"}
      pending={change.isPending}
      confirmDisabled={status === client.status}
      onConfirm={() => {
        change.mutate({ clientId: client.id, status });
      }}
    >
      <OptionSelect
        label="ステータス"
        options={GENERAL_STATUS_OPTIONS}
        value={status}
        onValueChange={(next) => {
          if (next) {
            setStatus(next);
          }
        }}
      />
    </ConfirmDialog>
  );
};

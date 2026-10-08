"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";
import { OptionSelect } from "@repo/ui/components/composed/option-select";

import type { BranchRow } from "@/features/branches/types";
import { GENERAL_STATUS_OPTIONS } from "@/lib/general-status-labels";
import { useTRPC } from "@/lib/trpc/react";

export type BranchStatusTarget = Pick<BranchRow, "id" | "name" | "status">;

export type BranchStatusDialogProps = {
  branch: BranchStatusTarget;
  onOpenChange: (open: boolean) => void;
};

/**
 * ステータス変更 (`branch.changeStatus`): the legacy confirmation with the status to change to; the
 * legacy row held a select and then asked, here the row menu opens this dialog holding it, as the
 * client and staff lists.
 */
export const BranchStatusDialog = ({ branch, onOpenChange }: BranchStatusDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(branch.status);

  const change = useMutation(
    trpc.branch.changeStatus.mutationOptions({
      onSuccess: async () => {
        toast.success("就業先部署のステータスを変更しました");
        onOpenChange(false);
        await queryClient.invalidateQueries(trpc.branch.pathFilter());
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`${branch.name}のステータス変更`}
      description="該当就業先部署のステータスを変更いたします。変更してよろしいでしょうか。"
      confirmLabel="変更"
      cancelLabel="キャンセル"
      pendingLabel="変更中…"
      destructive={status === "SUSPENDED"}
      pending={change.isPending}
      confirmDisabled={status === branch.status}
      onConfirm={() => {
        change.mutate({ branchId: branch.id, status });
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

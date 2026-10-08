"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";
import { OptionSelect } from "@repo/ui/components/composed/option-select";

import type { StaffRow } from "@/features/staff/types";
import { STAFF_STATUS_OPTIONS, staffNameOf } from "@/features/staff/utils/staff-labels";
import { useTRPC } from "@/lib/trpc/react";

export type StaffStatusTarget = Pick<StaffRow, "id" | "lastName" | "firstName" | "status">;

export type StaffStatusDialogProps = {
  staff: StaffStatusTarget;
  onOpenChange: (open: boolean) => void;
};

/**
 * ステータス変更 (`staff.changeStatus`): the legacy confirmation with the status to change to. The
 * legacy list changed it in a select inside the row and then asked; here the row menu and the
 * detail toolbar open this dialog, which holds the select (plan decision 8).
 */
export const StaffStatusDialog = ({ staff, onOpenChange }: StaffStatusDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(staff.status);

  const change = useMutation(
    trpc.staff.changeStatus.mutationOptions({
      onSuccess: async () => {
        toast.success("スタッフのステータスが変更されました");
        onOpenChange(false);
        await queryClient.invalidateQueries(trpc.staff.pathFilter());
      },
      onError: () => {
        toast.error("ステータスを変更できませんでした");
      },
    }),
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`${staffNameOf(staff)}さんのステータス変更`}
      description="該当スタッフのステータスを変更いたします。変更してよろしいでしょうか。"
      confirmLabel="変更"
      cancelLabel="キャンセル"
      pendingLabel="変更中…"
      destructive={status === "SUSPENDED"}
      pending={change.isPending}
      confirmDisabled={status === staff.status}
      onConfirm={() => {
        change.mutate({ staffId: staff.id, status });
      }}
    >
      <OptionSelect
        label="ステータス"
        options={STAFF_STATUS_OPTIONS}
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

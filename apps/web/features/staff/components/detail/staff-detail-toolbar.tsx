"use client";

import { FilePen, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";

import { useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import type { StaffStatus } from "@repo/validation";

import { href, routes } from "@/config/routes";

export type StaffDetailToolbarProps = {
  staff: { id: string; status: StaffStatus };
  onChangeStatus: () => void;
  onDelete: () => void;
};

/**
 * スタッフ情報詳細's actions, by ability: 編集, ステータス変更 and 削除, which appears for a 停止
 * staff only (legacy StaffDeleteButton). The legacy print and CSV buttons are not carried over.
 */
export const StaffDetailToolbar = ({
  staff,
  onChangeStatus,
  onDelete,
}: StaffDetailToolbarProps) => {
  const ability = useAbility();
  const canUpdate = ability.can("update", "Staff");
  const canChangeStatus = ability.can("status", "Staff");
  const canDelete = ability.can("delete", "Staff") && staff.status === "SUSPENDED";

  if (!canUpdate && !canChangeStatus && !canDelete) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canChangeStatus ? (
        <Button variant="outline" onClick={onChangeStatus}>
          <RefreshCw data-icon="inline-start" />
          ステータス変更
        </Button>
      ) : null}
      {canUpdate ? (
        <Button
          render={<Link href={href(routes.staff.update, { id: staff.id })} />}
          nativeButton={false}
        >
          <FilePen data-icon="inline-start" />
          編集
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 data-icon="inline-start" />
          削除
        </Button>
      ) : null}
    </div>
  );
};

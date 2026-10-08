"use client";

import { Eye, FilePen, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";

import { useAbility } from "@repo/permissions/react";
import { RowActions } from "@repo/ui/components/composed/row-actions";
import type { RowAction } from "@repo/ui/components/composed/row-actions";

import { href, routes } from "@/config/routes";
import type { StaffRow } from "@/features/staff/types";
import { staffNameOf } from "@/features/staff/utils/staff-labels";

export type StaffRowActionsProps = {
  staff: StaffRow;
  onChangeStatus: (staff: StaffRow) => void;
  onDelete: (staff: StaffRow) => void;
};

/**
 * The row's menu, by ability: スタッフ情報詳細, スタッフ情報編集, ステータス変更 (the legacy row's
 * status select) and スタッフ削除, which stays disabled until the staff is 停止 (legacy
 * `isDeleteAble`).
 */
export const StaffRowActions = ({ staff, onChangeStatus, onDelete }: StaffRowActionsProps) => {
  const ability = useAbility();

  const actions: RowAction[] = [
    ...(ability.can("read", "Staff")
      ? [
          {
            key: "detail",
            label: "スタッフ情報詳細",
            icon: <Eye />,
            render: <Link href={href(routes.staff.detail, { id: staff.id })} />,
          },
        ]
      : []),
    ...(ability.can("update", "Staff")
      ? [
          {
            key: "edit",
            label: "スタッフ情報編集",
            icon: <FilePen />,
            render: <Link href={href(routes.staff.update, { id: staff.id })} />,
          },
        ]
      : []),
    ...(ability.can("status", "Staff")
      ? [
          {
            key: "status",
            label: "ステータス変更",
            icon: <RefreshCw />,
            onSelect: () => {
              onChangeStatus(staff);
            },
          },
        ]
      : []),
    ...(ability.can("delete", "Staff")
      ? [
          {
            key: "delete",
            label: "スタッフ削除",
            icon: <Trash2 />,
            destructive: true,
            disabled: staff.status !== "SUSPENDED",
            onSelect: () => {
              onDelete(staff);
            },
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} label={`${staffNameOf(staff)}の操作`} />;
};

"use client";

import { Eye, FilePen, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";

import { useAbility } from "@repo/permissions/react";
import { RowActions } from "@repo/ui/components/composed/row-actions";
import type { RowAction } from "@repo/ui/components/composed/row-actions";

import { href, routes } from "@/config/routes";
import type { BranchRow } from "@/features/branches/types";

export type BranchRowActionsProps = {
  branch: BranchRow;
  onChangeStatus: (branch: BranchRow) => void;
  onDelete: (branch: BranchRow) => void;
};

/**
 * The row's menu, by ability, in the order of the other ported lists: 就業先情報詳細,
 * 就業先情報編集, ステータス変更 (the legacy row's status select) and 就業先削除, which stays disabled
 * until the branch is 停止 (legacy `isDeleteAble`).
 */
export const BranchRowActions = ({ branch, onChangeStatus, onDelete }: BranchRowActionsProps) => {
  const ability = useAbility();

  const actions: RowAction[] = [
    ...(ability.can("read", "Branch")
      ? [
          {
            key: "detail",
            label: "就業先情報詳細",
            icon: <Eye />,
            render: <Link href={href(routes.branch.detail, { id: branch.id })} />,
          },
        ]
      : []),
    ...(ability.can("update", "Branch")
      ? [
          {
            key: "edit",
            label: "就業先情報編集",
            icon: <FilePen />,
            render: <Link href={href(routes.branch.update, { id: branch.id })} />,
          },
        ]
      : []),
    ...(ability.can("status", "Branch")
      ? [
          {
            key: "status",
            label: "ステータス変更",
            icon: <RefreshCw />,
            onSelect: () => {
              onChangeStatus(branch);
            },
          },
        ]
      : []),
    ...(ability.can("delete", "Branch")
      ? [
          {
            key: "delete",
            label: "就業先削除",
            icon: <Trash2 />,
            destructive: true,
            disabled: branch.status !== "SUSPENDED",
            onSelect: () => {
              onDelete(branch);
            },
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} label={`${branch.name}の操作`} />;
};

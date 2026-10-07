"use client";

import { Ban, Eye, FilePen, RotateCcw } from "lucide-react";
import Link from "next/link";

import { userSubject } from "@repo/permissions";
import { useAbility } from "@repo/permissions/react";
import { RowActions } from "@repo/ui/components/composed/row-actions";
import type { RowAction } from "@repo/ui/components/composed/row-actions";

import { href, routes } from "@/config/routes";
import { userStatusOf } from "@/features/users/user-status-badge";
import type { UserStatusTarget } from "@/features/users/user-status-dialog";

export type UserRowActionsProps<TUser extends UserStatusTarget> = {
  user: TUser;
  onToggleStatus: (user: TUser) => void;
};

/**
 * The row's menu, by ability on this user: 担当者情報詳細 / 担当者情報編集 for an active user, 利用停止
 * or 利用再開 with `status User`. A deactivated user has no detail or edit page (`user.byId` does
 * not find them), so only 利用再開 remains.
 */
export const UserRowActions = <TUser extends UserStatusTarget>({
  user,
  onToggleStatus,
}: UserRowActionsProps<TUser>) => {
  const ability = useAbility();
  const subject = userSubject({ id: user.id });
  const active = userStatusOf(user) === "active";

  const actions: RowAction[] = [
    ...(active && ability.can("read", subject)
      ? [
          {
            key: "detail",
            label: "担当者情報詳細",
            icon: <Eye />,
            render: <Link href={href(routes.user.detail, { id: user.id })} />,
          },
        ]
      : []),
    ...(active && ability.can("update", subject)
      ? [
          {
            key: "edit",
            label: "担当者情報編集",
            icon: <FilePen />,
            render: <Link href={href(routes.user.update, { id: user.id })} />,
          },
        ]
      : []),
    ...(ability.can("status", subject)
      ? [
          {
            key: "status",
            label: active ? "利用停止" : "利用再開",
            icon: active ? <Ban /> : <RotateCcw />,
            destructive: active,
            onSelect: () => {
              onToggleStatus(user);
            },
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} label={`${user.name}の操作`} />;
};

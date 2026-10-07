"use client";

import { Ban, Eye, FilePen, MoreHorizontal, RotateCcw } from "lucide-react";
import Link from "next/link";

import { userSubject } from "@repo/permissions";
import { useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { href, routes } from "@/config/routes";
import { userStatusOf } from "@/features/users/user-status-badge";
import type { UserStatusTarget } from "@/features/users/user-status-dialog";

export type UserRowActionsProps<TUser extends UserStatusTarget> = {
  user: TUser;
  onToggleStatus: (user: TUser) => void;
};

/**
 * The row's menu: 担当者情報詳細 / 担当者情報編集 for an active user, 利用停止 or 利用再開 for a
 * caller holding `status User`. A deactivated user has no detail or edit page (the API does not
 * find them), so only 利用再開 remains. Nothing to offer → no menu.
 */
export const UserRowActions = <TUser extends UserStatusTarget>({
  user,
  onToggleStatus,
}: UserRowActionsProps<TUser>) => {
  const ability = useAbility();
  const subject = userSubject({ id: user.id });
  const active = userStatusOf(user) === "active";
  const canRead = active && ability.can("read", subject);
  const canUpdate = active && ability.can("update", subject);
  const canChangeStatus = ability.can("status", subject);

  if (!canRead && !canUpdate && !canChangeStatus) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`${user.name}の操作`} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {canRead ? (
          <DropdownMenuItem render={<Link href={href(routes.user.detail, { id: user.id })} />}>
            <Eye />
            担当者情報詳細
          </DropdownMenuItem>
        ) : null}
        {canUpdate ? (
          <DropdownMenuItem render={<Link href={href(routes.user.update, { id: user.id })} />}>
            <FilePen />
            担当者情報編集
          </DropdownMenuItem>
        ) : null}
        {canChangeStatus ? (
          <DropdownMenuItem
            variant={active ? "destructive" : "default"}
            onClick={() => {
              onToggleStatus(user);
            }}
          >
            {active ? <Ban /> : <RotateCcw />}
            {active ? "利用停止" : "利用再開"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

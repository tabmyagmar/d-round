"use client";

import { Ban, FilePen, Mail } from "lucide-react";
import Link from "next/link";

import { userSubject } from "@repo/permissions";
import { useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";

import { href, routes } from "@/config/routes";

export type UserDetailToolbarProps = {
  user: { id: string };
  onSendPasswordMail: () => void;
  onToggleStatus: () => void;
};

/**
 * 担当者情報詳細's actions, each by ability on this user: 編集 and パスワード設定メール need
 * `update`, 利用停止 needs `status`. The detail page only shows active users.
 */
export const UserDetailToolbar = ({
  user,
  onSendPasswordMail,
  onToggleStatus,
}: UserDetailToolbarProps) => {
  const ability = useAbility();
  const subject = userSubject({ id: user.id });
  const canUpdate = ability.can("update", subject);
  const canChangeStatus = ability.can("status", subject);

  if (!canUpdate && !canChangeStatus) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canUpdate ? (
        <>
          <Button variant="outline" onClick={onSendPasswordMail}>
            <Mail data-icon="inline-start" />
            パスワード設定メール
          </Button>
          <Button
            render={<Link href={href(routes.user.update, { id: user.id })} />}
            nativeButton={false}
          >
            <FilePen data-icon="inline-start" />
            編集
          </Button>
        </>
      ) : null}
      {canChangeStatus ? (
        <Button variant="destructive" onClick={onToggleStatus}>
          <Ban data-icon="inline-start" />
          利用停止
        </Button>
      ) : null}
    </div>
  );
};

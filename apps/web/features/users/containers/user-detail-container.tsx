"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { useAbility } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";
import { formatDate } from "@repo/ui/components/form";
import { Skeleton } from "@repo/ui/components/skeleton";
import { isOverridableRole } from "@repo/validation";

import { areaNamesOf, regionNamesOf } from "@/components/source/source-labels";
import { href, routes } from "@/config/routes";
import { UserChargesPlaceholder } from "@/features/users/components/detail/user-charges-placeholder";
import { UserDetailToolbar } from "@/features/users/components/detail/user-detail-toolbar";
import { RoleBadge } from "@/features/users/components/role-badge";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import { usePermissionCatalog } from "@/features/users/hooks/use-permission-catalog";
import { readingOf, userStatusOf } from "@/features/users/utils/user-labels";
import { POSITION_LABELS } from "@/lib/position-labels";
import { useTRPC } from "@/lib/trpc/react";

// Loaded only when used: the dialogs when an action is chosen, the summary for a manager.
const PasswordMailDialog = dynamic(
  () =>
    import("@/features/users/components/detail/password-mail-dialog").then(
      (module) => module.PasswordMailDialog,
    ),
  { ssr: false },
);
const UserStatusDialog = dynamic(
  () =>
    import("@/features/users/components/user-status-dialog").then(
      (module) => module.UserStatusDialog,
    ),
  { ssr: false },
);
const UserPermissionSummary = dynamic(
  () =>
    import("@/features/users/components/detail/user-permission-summary").then(
      (module) => module.UserPermissionSummary,
    ),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full" /> },
);

type OpenDialog = "password-mail" | "status" | null;

export type UserDetailContainerProps = {
  userId: string;
  /** 担当スタッフ, from the staff feature: the page composes the features. */
  staffs: ReactNode;
};

/**
 * 担当者情報詳細 (read-only, as in the legacy app): 基本情報, the 権限 of a manager for those who
 * may change them, then 担当クライアント (a placeholder) next to 担当スタッフ. Editing is on the
 * update page; after 利用停止 the user is gone from this page (`user.byId` does not find them).
 */
export const UserDetailContainer = ({ userId, staffs }: UserDetailContainerProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const ability = useAbility();
  const user = useQuery(trpc.user.byId.queryOptions({ userId }));
  const showPermissions =
    user.data !== undefined &&
    isOverridableRole(user.data.role) &&
    ability.can("changeRole", "User");
  const catalog = usePermissionCatalog(showPermissions);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const closeDialog = (open: boolean) => {
    if (!open) {
      setDialog(null);
    }
  };

  if (user.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (user.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>担当者情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{user.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = user.data;
  return (
    <>
      {/* The header holds the page's h1 (the route title); the user shown here is an h2. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-heading text-xl font-semibold">{detail.name}</h2>
          <p className="truncate text-sm text-muted-foreground">{detail.email}</p>
        </div>
        <UserDetailToolbar
          user={detail}
          onSendPasswordMail={() => {
            setDialog("password-mail");
          }}
          onToggleStatus={() => {
            setDialog("status");
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              // The legacy detail's fields and order (its read-only user form).
              items={[
                { label: "社員番号", value: detail.profile?.employeeNumber },
                { label: "氏名", value: detail.name },
                { label: "フリガナ", value: readingOf(detail) },
                { label: "エリア", value: areaNamesOf(detail.profile) },
                { label: "地域", value: regionNamesOf(detail.profile) },
                { label: "部署名", value: detail.profile?.departmentName },
                {
                  label: "役職",
                  value: detail.profile ? POSITION_LABELS[detail.profile.position] : null,
                },
                { label: "メールアドレス", value: detail.email },
                { label: "アカウントタイプ", value: <RoleBadge role={detail.role} /> },
                {
                  label: "退職日",
                  value: detail.profile?.retirementDate
                    ? formatDate(detail.profile.retirementDate, "ja-JP")
                    : null,
                },
                { label: "ステータス", value: <UserStatusBadge status={userStatusOf(detail)} /> },
                { label: "登録日", value: formatDate(detail.createdAt, "ja-JP") },
              ]}
            />
          </CardContent>
        </Card>

        {showPermissions ? (
          <Card>
            <CardHeader>
              <CardTitle>権限</CardTitle>
              <CardDescription>
                マネジャーの権限は担当者ごとに編集画面で調整できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {catalog.isError ? (
                <p className="text-sm text-destructive">{catalog.error.message}</p>
              ) : catalog.data ? (
                <UserPermissionSummary
                  catalog={catalog.data}
                  permissionKeys={detail.permissionKeys}
                />
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <UserChargesPlaceholder />
        {staffs}
      </div>

      {dialog === "password-mail" ? (
        <PasswordMailDialog user={detail} onOpenChange={closeDialog} />
      ) : null}
      {dialog === "status" ? (
        <UserStatusDialog
          user={detail}
          onOpenChange={closeDialog}
          onDone={() => {
            router.push(href(routes.user.list));
          }}
        />
      ) : null}
    </>
  );
};

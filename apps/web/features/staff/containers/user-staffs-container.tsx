"use client";

import { useQuery } from "@tanstack/react-query";

import { useAbility } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

import { UserStaffsCard } from "@/features/staff/components/user-staffs-card";
import { useTRPC } from "@/lib/trpc/react";

/**
 * The user detail's 担当スタッフ (`staff.byCharger`). The user detail page hands it to
 * `UserDetailContainer`, which shows it next to 担当クライアント: features do not import each
 * other, the page composes them. Nothing for a caller who may not read staff.
 */
export const UserStaffsContainer = ({ userId }: { userId: string }) => {
  const trpc = useTRPC();
  const canRead = useAbility().can("read", "Staff");
  const staffs = useQuery(trpc.staff.byCharger.queryOptions({ userId }, { enabled: canRead }));

  if (!canRead) {
    return null;
  }
  if (staffs.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>担当スタッフを読み込めませんでした</AlertTitle>
        <AlertDescription>{staffs.error.message}</AlertDescription>
      </Alert>
    );
  }
  if (staffs.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }
  return <UserStaffsCard staffs={staffs.data} />;
};

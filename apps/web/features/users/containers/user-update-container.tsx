"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAbility } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";
import { roleSchema } from "@repo/validation";
import type { Role } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { UserUpdateForm } from "@/features/users/components/form/user-update-form";
import { roleFieldState } from "@/features/users/utils/role-field-state";
import { useTRPC } from "@/lib/trpc/react";

export type Caller = { id: string; role: Role };

/**
 * 担当者情報編集: loads the user, saves the changes with `user.update`, then opens the detail page.
 * Nobody edits their own permissions (the API refuses it too).
 */
export const UserUpdateContainer = ({ userId, caller }: { userId: string; caller: Caller }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const canChangeRole = useAbility().can("changeRole", "User");
  const user = useQuery(trpc.user.byId.queryOptions({ userId }));
  const hierarchy = useSourceHierarchy();
  const update = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: async () => {
        toast.success("担当者情報を更新しました");
        await queryClient.invalidateQueries(trpc.user.pathFilter());
        router.push(href(routes.user.detail, { id: userId }));
      },
    }),
  );

  if (user.isPending) {
    return <Skeleton className="mx-auto h-64 w-full max-w-2xl" />;
  }
  if (user.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>担当者情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{user.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <UserUpdateForm
      // A refetch after saving resets the form to the stored values.
      key={user.data.updatedAt.toISOString()}
      user={user.data}
      roleField={roleFieldState({
        callerRole: caller.role,
        canChangeRole,
        currentRole: roleSchema.parse(user.data.role),
      })}
      canEditPermissions={canChangeRole && user.data.id !== caller.id}
      hierarchy={hierarchy}
      isEmployeeNumberFree={(employeeNumber) =>
        // A failed check lets the save through: the API refuses a taken number anyway.
        queryClient
          .query(
            trpc.user.employeeNumberAvailable.queryOptions(
              { employeeNumber, excludeUserId: userId },
              { staleTime: 0 },
            ),
          )
          .catch(() => true)
      }
      pending={update.isPending}
      onSubmit={(input) => {
        update.mutate(input);
      }}
    />
  );
};

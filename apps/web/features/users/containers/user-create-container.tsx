"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAbility } from "@repo/permissions/react";
import type { Role } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { href, routes } from "@/config/routes";
import { UserCreateForm } from "@/features/users/components/form/user-create-form";
import { roleFieldState } from "@/features/users/utils/role-field-state";
import { useTRPC } from "@/lib/trpc/react";

/**
 * 担当者追加: invites the user (`user.invite`), who receives the mail to set a password, then opens
 * their detail page. The roles offered follow the caller (`roleFieldState`).
 */
export const UserCreateContainer = ({ callerRole }: { callerRole: Role }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const canChangeRole = useAbility().can("changeRole", "User");
  const hierarchy = useSourceHierarchy();

  const invite = useMutation(
    trpc.user.invite.mutationOptions({
      onSuccess: async (user) => {
        toast.success(`${user.name}さんに招待メールを送信しました`);
        await queryClient.invalidateQueries(trpc.user.pathFilter());
        router.push(href(routes.user.detail, { id: user.id }));
      },
    }),
  );

  return (
    <UserCreateForm
      roleField={roleFieldState({ callerRole, canChangeRole })}
      canEditPermissions={canChangeRole}
      hierarchy={hierarchy}
      isEmployeeNumberFree={(employeeNumber) =>
        // A failed check lets the invite through: the API refuses a taken number anyway.
        queryClient
          .query(
            trpc.user.employeeNumberAvailable.queryOptions({ employeeNumber }, { staleTime: 0 }),
          )
          .catch(() => true)
      }
      pending={invite.isPending}
      errorMessage={invite.isError ? invite.error.message : undefined}
      onSubmit={(input) => {
        invite.mutate(input);
      }}
    />
  );
};

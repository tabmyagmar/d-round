"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listUsersSchema } from "@repo/validation";

import { UsersTable } from "@/features/users/components/users-table";
import { UsersToolbar } from "@/features/users/components/users-toolbar";
import type { UserRow } from "@/features/users/types";
import { userFiltersOf } from "@/features/users/utils/user-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

// Loaded when a row's 利用停止 / 利用再開 is chosen, not with the list.
const UserStatusDialog = dynamic(
  () =>
    import("@/features/users/components/user-status-dialog").then(
      (module) => module.UserStatusDialog,
    ),
  { ssr: false },
);

/**
 * 担当者管理: the URL is the list's state (search, role, status, page, sort), read through the
 * API's own input schema; the previous page stays on screen while the next one loads.
 */
export const UsersContainer = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listUsersSchema, searchParams), [searchParams]);
  const users = useQuery(trpc.user.list.queryOptions(input, { placeholderData: keepPreviousData }));
  const { sorting, pagination } = useTableState(users.data);
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <UsersToolbar filters={userFiltersOf(input)} onChange={setMany} />
      {users.isError ? (
        <Alert variant="destructive">
          <AlertTitle>担当者一覧を読み込めませんでした</AlertTitle>
          <AlertDescription>{users.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <UsersTable
        data={users.data?.items}
        isLoading={users.isPending}
        sorting={sorting}
        pagination={pagination}
        onToggleStatus={setStatusTarget}
      />
      {statusTarget ? (
        <UserStatusDialog
          user={statusTarget}
          onOpenChange={(open) => {
            if (!open) {
              setStatusTarget(null);
            }
          }}
        />
      ) : null}
    </div>
  );
};

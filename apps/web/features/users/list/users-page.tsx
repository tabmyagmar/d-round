"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listUsersSchema } from "@repo/validation";

import { UsersTable } from "@/features/users/list/users-table";
import type { UserRow } from "@/features/users/list/users-table";
import { UsersToolbar } from "@/features/users/list/users-toolbar";
import { UserStatusDialog } from "@/features/users/user-status-dialog";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

/**
 * 担当者管理: the URL is the list's state (search, role, status, page, sort), read through the
 * API's own input schema; the previous page stays on screen while the next one loads.
 */
export const UsersPage = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listUsersSchema, searchParams), [searchParams]);
  const users = useQuery(trpc.user.list.queryOptions(input, { placeholderData: keepPreviousData }));
  const { sorting, pagination } = useTableState(users.data);
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <UsersToolbar
        filters={{
          search: input.search ?? "",
          role: input.role ?? null,
          status: input.status ?? "active",
        }}
        onChange={setMany}
      />
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
      <UserStatusDialog
        user={statusTarget}
        onOpenChange={(open) => {
          if (!open) {
            setStatusTarget(null);
          }
        }}
      />
    </div>
  );
};

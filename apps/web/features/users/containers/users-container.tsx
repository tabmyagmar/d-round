"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listUsersSchema } from "@repo/validation";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { UsersTable } from "@/features/users/components/list/users-table";
import { UsersToolbar } from "@/features/users/components/list/users-toolbar";
import type { UserRow } from "@/features/users/types";
import { userFiltersOf } from "@/features/users/utils/user-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";
import { RowSelectionProvider } from "@/stores/row-selection";

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
 * API's own input schema; the previous page stays on screen while the next one loads. The selected
 * rows live in the list's row selection (`RowSelectionProvider`), shared by the table and toolbar.
 */
export const UsersContainer = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listUsersSchema, searchParams), [searchParams]);
  const users = useQuery(trpc.user.list.queryOptions(input, { placeholderData: keepPreviousData }));
  const { sorting, pagination } = useTableState(users.data);
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);
  const filters = userFiltersOf(input);
  // Region names for the 地域 tag; fetched only while that filter is in effect.
  const hierarchy = useSourceHierarchy(filters.regionCodes.length > 0);

  return (
    <RowSelectionProvider>
      <div className="flex flex-col gap-4">
        <UsersToolbar filters={filters} regions={hierarchy.regions} onChange={setMany} />
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
    </RowSelectionProvider>
  );
};

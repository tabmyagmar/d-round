"use client";

import Link from "next/link";
import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type {
  DataTablePagination,
  DataTableSorting,
} from "@repo/ui/components/composed/data-table";

import { href, routes } from "@/config/routes";
import { RoleBadge } from "@/features/users/components/role-badge";
import { UserRowActions } from "@/features/users/components/user-row-actions";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import { useUsersStore } from "@/features/users/stores/users-store-provider";
import type { UserRow } from "@/features/users/types";
import { userStatusOf } from "@/features/users/utils/user-labels";

const helper = createDataTableColumns<UserRow>();

/**
 * The legacy 担当者管理 columns that `User` carries today. 社員番号 (before 氏名) and エリア / 地域
 * (after メールアドレス) come with the user-profile ticket. 氏名 and メールアドレス sort on the server.
 */
const userColumns = (onToggleStatus: (user: UserRow) => void) =>
  helper.columns([
    helper.accessor("name", {
      header: "氏名",
      enableSorting: true,
      cell: ({ row, getValue }) =>
        userStatusOf(row.original) === "active" ? (
          <Link
            href={href(routes.user.detail, { id: row.original.id })}
            className="font-medium hover:underline"
          >
            {getValue()}
          </Link>
        ) : (
          <span className="font-medium text-muted-foreground">{getValue()}</span>
        ),
    }),
    helper.accessor("email", {
      header: "メールアドレス",
      enableSorting: true,
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    }),
    helper.accessor("role", {
      header: "アカウントタイプ",
      cell: ({ getValue }) => <RoleBadge role={getValue()} />,
    }),
    helper.display({
      id: "status",
      header: "ステータス",
      cell: ({ row }) => <UserStatusBadge status={userStatusOf(row.original)} />,
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <UserRowActions user={row.original} onToggleStatus={onToggleStatus} />
        </div>
      ),
    }),
  ]);

/** Module-level so the selection column is built once, not on every render. */
const SELECTION_LABELS = {
  all: "このページの担当者をすべて選択",
  row: (user: UserRow) => `${user.name}を選択`,
};

export type UsersTableProps = {
  data: UserRow[] | undefined;
  isLoading: boolean;
  sorting: DataTableSorting;
  pagination: DataTablePagination | undefined;
  /** 利用停止 / 利用再開 was chosen for this row; the caller confirms and applies it. */
  onToggleStatus: (user: UserRow) => void;
};

export const UsersTable = ({
  data,
  isLoading,
  sorting,
  pagination,
  onToggleStatus,
}: UsersTableProps) => {
  const columns = useMemo(() => userColumns(onToggleStatus), [onToggleStatus]);
  const rowSelection = useUsersStore((store) => store.rowSelection);
  const setRowSelection = useUsersStore((store) => store.setRowSelection);
  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="該当する担当者はいません"
      getRowId={(row) => row.id}
      sorting={sorting}
      rowSelection={{
        state: rowSelection,
        onChange: setRowSelection,
        labels: SELECTION_LABELS,
      }}
      {...(pagination ? { pagination } : {})}
    />
  );
};

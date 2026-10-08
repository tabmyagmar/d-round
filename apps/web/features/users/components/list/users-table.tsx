"use client";

import Link from "next/link";
import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type {
  DataTablePagination,
  DataTableSorting,
} from "@repo/ui/components/composed/data-table";

import { areaNamesOf, regionNamesOf } from "@/components/source/source-labels";
import { href, routes } from "@/config/routes";
import { UserRowActions } from "@/features/users/components/list/user-row-actions";
import { RoleBadge } from "@/features/users/components/role-badge";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import type { UserRow } from "@/features/users/types";
import { readingOf, userStatusOf } from "@/features/users/utils/user-labels";
import { useRowSelection } from "@/stores/row-selection";

const helper = createDataTableColumns<UserRow>();

/**
 * The legacy 担当者管理 columns: 社員番号, 氏名, メールアドレス, エリア, 地域, アカウントタイプ,
 * ステータス. 社員番号, 氏名 and メールアドレス sort on the server; a user without a profile shows —.
 */
const userColumns = (onToggleStatus: (user: UserRow) => void) =>
  helper.columns([
    helper.accessor((row) => row.profile?.employeeNumber ?? null, {
      id: "employeeNumber",
      header: "社員番号",
      enableSorting: true,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() ?? "—"}</span>,
    }),
    helper.accessor("name", {
      header: "氏名",
      enableSorting: true,
      cell: ({ row, getValue }) => (
        <div className="flex flex-col">
          {userStatusOf(row.original) === "active" ? (
            <Link
              href={href(routes.user.detail, { id: row.original.id })}
              className="font-medium hover:underline"
            >
              {getValue()}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">{getValue()}</span>
          )}
          {readingOf(row.original) ? (
            <span className="text-xs text-muted-foreground">{readingOf(row.original)}</span>
          ) : null}
        </div>
      ),
    }),
    helper.accessor("email", {
      header: "メールアドレス",
      enableSorting: true,
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    }),
    helper.display({
      id: "areas",
      header: "エリア",
      cell: ({ row }) => areaNamesOf(row.original.profile) ?? "—",
    }),
    helper.display({
      id: "regions",
      header: "地域",
      cell: ({ row }) => regionNamesOf(row.original.profile) ?? "—",
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
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  return (
    <DataTable
      title="全担当者数"
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

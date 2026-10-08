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
import { StaffRowActions } from "@/features/staff/components/list/staff-row-actions";
import { StaffStatusBadge } from "@/features/staff/components/staff-status-badge";
import type { StaffRow } from "@/features/staff/types";
import { staffNameOf, staffReadingOf } from "@/features/staff/utils/staff-labels";
import { useRowSelection } from "@/stores/row-selection";

const helper = createDataTableColumns<StaffRow>();

type RowHandlers = Pick<StaffsTableProps, "onChangeStatus" | "onDelete">;

/**
 * The legacy スタッフ管理 columns: スタッフ番号, スタッフ名, 担当者, エリア, 地域, 支店名,
 * ステータス. スタッフ番号 and スタッフ名 sort on the server; 担当者 are the current ones.
 */
const staffColumns = ({ onChangeStatus, onDelete }: RowHandlers) =>
  helper.columns([
    helper.accessor("employeeNumber", {
      header: "スタッフ番号",
      enableSorting: true,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }),
    helper.accessor((row) => staffNameOf(row), {
      id: "name",
      header: "スタッフ名",
      enableSorting: true,
      cell: ({ row, getValue }) => (
        <div className="flex flex-col">
          <Link
            href={href(routes.staff.detail, { id: row.original.id })}
            className="font-medium hover:underline"
          >
            {getValue()}
          </Link>
          <span className="text-xs text-muted-foreground">{staffReadingOf(row.original)}</span>
        </div>
      ),
    }),
    helper.display({
      id: "chargers",
      header: "担当者",
      // The legacy cell scrolled sideways; the names wrap instead.
      cell: ({ row }) => (
        <span className="block max-w-48 whitespace-normal">
          {row.original.chargers.map((charger) => charger.user.name).join("、") || "—"}
        </span>
      ),
    }),
    helper.display({
      id: "areas",
      header: "エリア",
      cell: ({ row }) => areaNamesOf(row.original) ?? "—",
    }),
    helper.display({
      id: "regions",
      header: "地域",
      cell: ({ row }) => regionNamesOf(row.original) ?? "—",
    }),
    helper.accessor("branchName", {
      header: "支店名",
      cell: ({ getValue }) => getValue() ?? "—",
    }),
    helper.accessor("status", {
      header: "ステータス",
      cell: ({ getValue }) => <StaffStatusBadge status={getValue()} />,
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <StaffRowActions
            staff={row.original}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
          />
        </div>
      ),
    }),
  ]);

/** Module-level so the selection column is built once, not on every render. */
const SELECTION_LABELS = {
  all: "このページのスタッフをすべて選択",
  row: (staff: StaffRow) => `${staffNameOf(staff)}を選択`,
};

export type StaffsTableProps = {
  data: StaffRow[] | undefined;
  isLoading: boolean;
  sorting: DataTableSorting;
  pagination: DataTablePagination | undefined;
  /** ステータス変更 was chosen for this row; the caller opens the dialog. */
  onChangeStatus: (staff: StaffRow) => void;
  /** スタッフ削除 was chosen for this (停止) row; the caller confirms and deletes. */
  onDelete: (staff: StaffRow) => void;
};

export const StaffsTable = ({
  data,
  isLoading,
  sorting,
  pagination,
  onChangeStatus,
  onDelete,
}: StaffsTableProps) => {
  const columns = useMemo(
    () => staffColumns({ onChangeStatus, onDelete }),
    [onChangeStatus, onDelete],
  );
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  return (
    <DataTable
      title="全スタッフ数"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="該当するスタッフはいません"
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

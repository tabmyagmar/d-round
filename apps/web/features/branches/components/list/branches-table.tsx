"use client";

import Link from "next/link";
import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type {
  DataTablePagination,
  DataTableSorting,
} from "@repo/ui/components/composed/data-table";

import { GeneralStatusBadge } from "@/components/general-status-badge";
import { addressLineOf, postCodeLabel } from "@/components/source/source-labels";
import { href, routes } from "@/config/routes";
import { BranchRowActions } from "@/features/branches/components/list/branch-row-actions";
import type { BranchRow } from "@/features/branches/types";
import { chargerNamesOf } from "@/lib/charger-labels";
import { useRowSelection } from "@/stores/row-selection";

const helper = createDataTableColumns<BranchRow>();

type RowHandlers = Pick<BranchesTableProps, "onChangeStatus" | "onDelete">;

/**
 * The legacy 就業先部署 columns: 就業先番号, 就業先名 (with its reading), クライアント名, 担当者,
 * 郵便番号・住所 (the 部署's), ステータス. 番号, 名 and クライアント名 sort on the server (the names by
 * their readings).
 */
const branchColumns = ({ onChangeStatus, onDelete }: RowHandlers) =>
  helper.columns([
    helper.accessor("number", {
      header: "就業先番号",
      enableSorting: true,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }),
    helper.accessor("name", {
      header: "就業先名",
      enableSorting: true,
      cell: ({ row, getValue }) => (
        <div className="flex max-w-56 flex-col whitespace-normal">
          <Link
            href={href(routes.branch.detail, { id: row.original.id })}
            className="font-medium hover:underline"
          >
            {getValue()}
          </Link>
          <span className="text-xs text-muted-foreground">{row.original.nameKana}</span>
        </div>
      ),
    }),
    helper.accessor((row) => row.client.name, {
      id: "client",
      header: "クライアント名",
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="block max-w-48 whitespace-normal">{getValue()}</span>
      ),
    }),
    helper.display({
      id: "chargers",
      header: "担当者",
      cell: ({ row }) => (
        <span className="block max-w-48 whitespace-normal">
          {chargerNamesOf(row.original.chargers) ?? "—"}
        </span>
      ),
    }),
    helper.display({
      id: "address",
      header: "郵便番号・住所",
      cell: ({ row }) => {
        const { address } = row.original;
        return address ? (
          <div className="flex max-w-64 flex-col whitespace-normal">
            <span className="tabular-nums">{postCodeLabel(address.postCode)}</span>
            <span>{addressLineOf(address)}</span>
          </div>
        ) : (
          "—"
        );
      },
    }),
    helper.accessor("status", {
      header: "ステータス",
      cell: ({ getValue }) => <GeneralStatusBadge status={getValue()} />,
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <BranchRowActions
            branch={row.original}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
          />
        </div>
      ),
    }),
  ]);

/** Module-level so the selection column is built once, not on every render. */
const SELECTION_LABELS = {
  all: "このページの就業先部署をすべて選択",
  row: (branch: BranchRow) => `${branch.name}を選択`,
};

export type BranchesTableProps = {
  data: BranchRow[] | undefined;
  isLoading: boolean;
  sorting: DataTableSorting;
  pagination: DataTablePagination | undefined;
  /** ステータス変更 was chosen for this row; the caller opens the dialog. */
  onChangeStatus: (branch: BranchRow) => void;
  /** 就業先削除 was chosen for this (停止) row; the caller confirms and deletes. */
  onDelete: (branch: BranchRow) => void;
};

export const BranchesTable = ({
  data,
  isLoading,
  sorting,
  pagination,
  onChangeStatus,
  onDelete,
}: BranchesTableProps) => {
  const columns = useMemo(
    () => branchColumns({ onChangeStatus, onDelete }),
    [onChangeStatus, onDelete],
  );
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  return (
    <DataTable
      title="全就業先部署数"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="該当する就業先部署はありません"
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

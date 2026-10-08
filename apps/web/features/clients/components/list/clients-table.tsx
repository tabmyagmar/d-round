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
import { ClientRowActions } from "@/features/clients/components/list/client-row-actions";
import type { ClientRow } from "@/features/clients/types";
import { orderTypeNamesOf } from "@/features/clients/utils/client-labels";
import { chargerNamesOf } from "@/lib/charger-labels";
import { useRowSelection } from "@/stores/row-selection";

const helper = createDataTableColumns<ClientRow>();

type RowHandlers = Pick<ClientsTableProps, "onChangeStatus" | "onDelete">;

/**
 * The legacy クライアント管理 columns: クライアント番号, クライアント名, 担当者, 受注区分,
 * 郵便番号・住所, 電話番号, ステータス. 番号 and 名 sort on the server (名 by its reading).
 */
const clientColumns = ({ onChangeStatus, onDelete }: RowHandlers) =>
  helper.columns([
    helper.accessor("number", {
      header: "クライアント番号",
      enableSorting: true,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }),
    helper.accessor("name", {
      header: "クライアント名",
      enableSorting: true,
      cell: ({ row, getValue }) => (
        <Link
          href={href(routes.client.detail, { id: row.original.id })}
          className="block max-w-56 font-medium whitespace-normal hover:underline"
        >
          {getValue()}
        </Link>
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
      id: "orderTypes",
      header: "受注区分",
      cell: ({ row }) => orderTypeNamesOf(row.original.orderTypes) ?? "—",
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
    helper.accessor("phoneNumber", {
      header: "電話番号",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
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
          <ClientRowActions
            client={row.original}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
          />
        </div>
      ),
    }),
  ]);

/** Module-level so the selection column is built once, not on every render. */
const SELECTION_LABELS = {
  all: "このページのクライアントをすべて選択",
  row: (client: ClientRow) => `${client.name}を選択`,
};

export type ClientsTableProps = {
  data: ClientRow[] | undefined;
  isLoading: boolean;
  sorting: DataTableSorting;
  pagination: DataTablePagination | undefined;
  /** ステータス変更 was chosen for this row; the caller opens the dialog. */
  onChangeStatus: (client: ClientRow) => void;
  /** クライアント削除 was chosen for this (停止) row; the caller confirms and deletes. */
  onDelete: (client: ClientRow) => void;
};

export const ClientsTable = ({
  data,
  isLoading,
  sorting,
  pagination,
  onChangeStatus,
  onDelete,
}: ClientsTableProps) => {
  const columns = useMemo(
    () => clientColumns({ onChangeStatus, onDelete }),
    [onChangeStatus, onDelete],
  );
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const setRowSelection = useRowSelection((store) => store.setRowSelection);
  return (
    <DataTable
      title="全クライアント数"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="該当するクライアントはいません"
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

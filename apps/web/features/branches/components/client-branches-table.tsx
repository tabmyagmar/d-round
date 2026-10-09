"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@repo/ui/components/button";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTablePagination } from "@repo/ui/components/composed/data-table";

import type { BranchRow } from "@/features/branches/types";

const helper = createDataTableColumns<BranchRow>();

/**
 * A client's 就業先部署, the legacy ClientBranches columns: 就業先番号, 就業先名, 部署名, 担当者名
 * (the 連絡担当者), and the chevron that opens the branch in a dialog. The legacy row checkboxes
 * served its print button, which did nothing; neither is carried over.
 */
const clientBranchColumns = (onOpen: (branch: BranchRow) => void) =>
  helper.columns([
    helper.accessor("number", {
      header: "就業先番号",
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }),
    helper.accessor("name", { header: "就業先名" }),
    helper.accessor("departmentName", { header: "部署名" }),
    helper.display({
      id: "contact",
      header: "担当者名",
      cell: ({ row }) => `${row.original.contactLastName} ${row.original.contactFirstName}`,
    }),
    helper.display({
      id: "open",
      header: () => <span className="sr-only">詳細</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`${row.original.name}の詳細`}
            onClick={() => {
              onOpen(row.original);
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      ),
    }),
  ]);

export type ClientBranchesTableProps = {
  data: BranchRow[] | undefined;
  isLoading: boolean;
  pagination: DataTablePagination | undefined;
  /** The chevron of this row was pressed; the caller opens its dialog. */
  onOpen: (branch: BranchRow) => void;
};

export const ClientBranchesTable = ({
  data,
  isLoading,
  pagination,
  onOpen,
}: ClientBranchesTableProps) => {
  const columns = useMemo(() => clientBranchColumns(onOpen), [onOpen]);
  return (
    <DataTable
      title="就業先部署情報"
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyMessage="就業先部署はありません"
      getRowId={(row) => row.id}
      {...(pagination ? { pagination } : {})}
    />
  );
};

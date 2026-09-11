"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Skeleton } from "../skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

/**
 * Headless TanStack Table v9 + shadcn Table markup. Columns are declared with
 * `createDataTableColumns<Row>()`; paging is server-side (the API returns `PageResult`), so the
 * table only renders the page it is given and reports page changes.
 */
export const dataTableFeatures = tableFeatures({});
export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumns<TData extends RowData> = readonly ColumnDef<
  DataTableFeatures,
  TData
>[];

export const createDataTableColumns = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>();

export type DataTablePagination = {
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  /** Singular noun for the summary line, e.g. "user". */
  itemLabel?: string;
};

export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumns<TData>;
  data: TData[] | undefined;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  pagination?: DataTablePagination;
  getRowId?: (row: TData, index: number) => string;
  className?: string;
};

const EMPTY_DATA: never[] = [];
const SKELETON_ROWS = 5;

export const DataTable = <TData extends RowData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Nothing to show.",
  pagination,
  getRowId,
  className,
}: DataTableProps<TData>) => {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? EMPTY_DATA,
    ...(getRowId ? { getRowId } : {}),
  });
  const columnCount = columns.length;
  const rows = table.getRowModel().rows;

  return (
    <div className={className}>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <TableRow key={`skeleton-${String(index)}`}>
                    <TableCell colSpan={columnCount}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {pagination.total} {pagination.itemLabel ?? "item"}
            {pagination.total === 1 ? "" : "s"} · page {pagination.page} of{" "}
            {Math.max(1, pagination.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => {
                pagination.onPageChange(pagination.page - 1);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => {
                pagination.onPageChange(pagination.page + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

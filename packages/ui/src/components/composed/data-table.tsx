"use client";

import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, OnChangeFn, RowData, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Skeleton } from "../skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

/**
 * Headless TanStack Table v9 + shadcn Table markup. Columns are declared with
 * `createDataTableColumns<Row>()`; paging and sorting are server-side (the API returns
 * `PageResult` in the requested order), so the table renders the rows it is given as they come and
 * only reports page and sort changes.
 */
export const dataTableFeatures = tableFeatures({ rowSortingFeature });
export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumns<TData extends RowData> = readonly ColumnDef<
  DataTableFeatures,
  TData
>[];

export const createDataTableColumns = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>();

export type DataTablePaginationLabels = {
  previous?: ReactNode;
  next?: ReactNode;
  /** Replaces the default "12 users · page 1 of 2" line. */
  summary?: (page: { page: number; totalPages: number; total: number }) => ReactNode;
};

export type DataTablePagination = {
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  /** Singular noun for the default summary line, e.g. "user". */
  itemLabel?: string;
  labels?: DataTablePaginationLabels;
};

export type DataTableSortingState = SortingState;

/**
 * Controlled, single-column sorting. A column takes part with `enableSorting: true`; clicking its
 * header toggles ascending ↔ descending (never back to unsorted) and reports the next state.
 */
export type DataTableSorting = {
  state: DataTableSortingState;
  onChange: OnChangeFn<DataTableSortingState>;
};

export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumns<TData>;
  data: TData[] | undefined;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  pagination?: DataTablePagination;
  sorting?: DataTableSorting;
  getRowId?: (row: TData, index: number) => string;
  className?: string;
};

const EMPTY_DATA: never[] = [];
const SKELETON_ROWS = 5;

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

const SortIcon = ({ direction }: { direction: false | "asc" | "desc" }) => {
  if (direction === "asc") {
    return <ArrowUp aria-hidden className="size-3.5" />;
  }
  if (direction === "desc") {
    return <ArrowDown aria-hidden className="size-3.5" />;
  }
  return <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />;
};

export const DataTable = <TData extends RowData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Nothing to show.",
  pagination,
  sorting,
  getRowId,
  className,
}: DataTableProps<TData>) => {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? EMPTY_DATA,
    // Columns opt in to sorting; rows arrive sorted from the server.
    defaultColumn: { enableSorting: false },
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    ...(sorting
      ? { state: { sorting: sorting.state }, onSortingChange: sorting.onChange }
      : { enableSorting: false }),
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
                {group.headers.map((header) => {
                  const direction = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={direction ? ARIA_SORT[direction] : undefined}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2.5 h-8"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon direction={direction} />
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
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
            {pagination.labels?.summary ? (
              pagination.labels.summary({
                page: pagination.page,
                totalPages: Math.max(1, pagination.totalPages),
                total: pagination.total,
              })
            ) : (
              <>
                {pagination.total} {pagination.itemLabel ?? "item"}
                {pagination.total === 1 ? "" : "s"} · page {pagination.page} of{" "}
                {Math.max(1, pagination.totalPages)}
              </>
            )}
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
              {pagination.labels?.previous ?? "Previous"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => {
                pagination.onPageChange(pagination.page + 1);
              }}
            >
              {pagination.labels?.next ?? "Next"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

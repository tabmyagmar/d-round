"use client";

import {
  createColumnHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  OnChangeFn,
  RowData,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { Badge } from "../badge";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Skeleton } from "../skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

import { ContentCard } from "./content-card";
import { PaginationBar } from "./pagination-bar";
import type { PaginationBarLabels, PaginationBarProps } from "./pagination-bar";

/**
 * Headless TanStack Table v9 + shadcn Table markup on one `ContentCard`: the header carries the
 * title with the total and the `PaginationBar`, the table sits under it. Columns are declared with
 * `createDataTableColumns<Row>()`; paging and sorting are server-side (the API returns
 * `PageResult` in the requested order), so the table renders the rows it is given as they come and
 * only reports page, sort and selection changes.
 */
export const dataTableFeatures = tableFeatures({ rowSortingFeature, rowSelectionFeature });
export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumns<TData extends RowData> = readonly ColumnDef<
  DataTableFeatures,
  TData
>[];

export const createDataTableColumns = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>();

export type DataTablePaginationLabels = PaginationBarLabels;

/**
 * `PaginationBar`'s props plus the `total`: the API's `PageResult` paging fields and
 * `onPageChange`. The total is shown next to the title.
 */
export type DataTablePagination = Omit<PaginationBarProps, "className"> & { total: number };

export type DataTableSortingState = SortingState;

/**
 * Controlled, single-column sorting. A column takes part with `enableSorting: true`; clicking its
 * header toggles ascending ↔ descending (never back to unsorted) and reports the next state.
 */
export type DataTableSorting = {
  state: DataTableSortingState;
  onChange: OnChangeFn<DataTableSortingState>;
};

export type DataTableRowSelectionState = RowSelectionState;

/**
 * Controlled row selection, keyed by `getRowId` so it survives paging. Adds a checkbox column
 * (select one row, or every row of the page from the header).
 */
export type DataTableRowSelection<TData extends RowData> = {
  state: DataTableRowSelectionState;
  onChange: OnChangeFn<DataTableRowSelectionState>;
  /** Accessible names: the header's select-all box and each row's box. */
  labels?: { all?: string; row?: (row: TData, index: number) => string };
};

export type DataTableProps<TData extends RowData> = {
  /** The card's title; the total (or the row count without pagination) is shown next to it. */
  title?: ReactNode;
  columns: DataTableColumns<TData>;
  data: TData[] | undefined;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  pagination?: DataTablePagination;
  sorting?: DataTableSorting;
  rowSelection?: DataTableRowSelection<TData>;
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
  title,
  columns,
  data,
  isLoading = false,
  emptyMessage = "Nothing to show.",
  pagination,
  sorting,
  rowSelection,
  getRowId,
  className,
}: DataTableProps<TData>) => {
  const selectable = rowSelection !== undefined;
  const allLabel = rowSelection?.labels?.all ?? "Select all rows on this page";
  const rowLabel = rowSelection?.labels?.row;
  const allColumns = useMemo((): DataTableColumns<TData> => {
    if (!selectable) {
      return columns;
    }
    const helper = createDataTableColumns<TData>();
    return [
      helper.display({
        id: "select",
        header: ({ table: current }) => {
          // TanStack's "some" is true while every page row is selected too; mixed means "not all".
          const all = current.getIsAllPageRowsSelected();
          return (
            <Checkbox
              aria-label={allLabel}
              checked={all}
              indeterminate={!all && current.getIsSomePageRowsSelected()}
              onCheckedChange={(checked) => {
                current.toggleAllPageRowsSelected(checked);
              }}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            aria-label={
              rowLabel ? rowLabel(row.original, row.index) : `Select row ${String(row.index + 1)}`
            }
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => {
              row.toggleSelected(checked);
            }}
          />
        ),
      }),
      ...columns,
    ];
  }, [columns, selectable, allLabel, rowLabel]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data: data ?? EMPTY_DATA,
    // Columns opt in to sorting; rows arrive sorted from the server.
    defaultColumn: { enableSorting: false },
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    ...(sorting ? { onSortingChange: sorting.onChange } : { enableSorting: false }),
    ...(rowSelection
      ? {
          enableRowSelection: true,
          onRowSelectionChange: rowSelection.onChange,
        }
      : { enableRowSelection: false }),
    ...(sorting || rowSelection
      ? {
          state: {
            ...(sorting ? { sorting: sorting.state } : {}),
            ...(rowSelection ? { rowSelection: rowSelection.state } : {}),
          },
        }
      : {}),
    ...(getRowId ? { getRowId } : {}),
  });
  const columnCount = allColumns.length;
  const rows = table.getRowModel().rows;
  const count = pagination?.total ?? data?.length;

  return (
    <ContentCard
      title={
        title === undefined ? undefined : (
          <>
            {title}
            {count === undefined ? null : (
              <Badge variant="outline" className="tabular-nums">
                {count}
              </Badge>
            )}
          </>
        )
      }
      actions={pagination ? <PaginationBar {...pagination} /> : undefined}
      {...(className === undefined ? {} : { className })}
    >
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
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
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
    </ContentCard>
  );
};

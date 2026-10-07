"use client";

import { useMemo } from "react";

import type {
  DataTablePagination,
  DataTablePaginationLabels,
  DataTableSorting,
} from "@repo/ui/components/composed/data-table";

import { pageToParam, sortingFromParams, sortingToParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";

/** The paging fields of the API's `PageResult`. */
export type PageSummary = {
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export const PAGINATION_LABELS: DataTablePaginationLabels = {
  first: "最初のページ",
  previous: "前のページ",
  next: "次のページ",
  last: "最後のページ",
  pageInput: "ページ番号",
  summary: ({ total, page, totalPages }) =>
    `全 ${String(total)} 件 · ${String(page)} / ${String(totalPages)} ページ`,
};

/**
 * `DataTable` sorting and pagination bound to the URL (`sortBy`, `sortOrder`, `page`), for a list
 * whose query input is read from the same URL. Pass the current page of results, if any.
 */
export const useTableState = (
  current: PageSummary | undefined,
): { sorting: DataTableSorting; pagination: DataTablePagination | undefined } => {
  const { searchParams, setMany } = useSearch();

  const sorting = useMemo((): DataTableSorting => {
    const state = sortingFromParams(searchParams);
    return {
      state,
      onChange: (updater) => {
        setMany(sortingToParams(typeof updater === "function" ? updater(state) : updater));
      },
    };
  }, [searchParams, setMany]);

  const pagination = useMemo(
    (): DataTablePagination | undefined =>
      current
        ? {
            page: current.page,
            totalPages: current.totalPages,
            total: current.total,
            hasPrev: current.hasPrev,
            hasNext: current.hasNext,
            onPageChange: (page) => {
              setMany({ page: pageToParam(page) });
            },
            labels: PAGINATION_LABELS,
          }
        : undefined,
    [current, setMany],
  );

  return { sorting, pagination };
};

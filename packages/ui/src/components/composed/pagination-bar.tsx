"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Input } from "../input";

export type PaginationBarLabels = {
  first?: string;
  previous?: string;
  next?: string;
  last?: string;
  /** Accessible name and placeholder of the page-number box. */
  pageInput?: string;
  /** Replaces the default "12 items · page 1 of 2" line. */
  summary?: (page: { page: number; totalPages: number; total: number }) => ReactNode;
};

export type PaginationBarProps = {
  /** 1-based. */
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  /** Singular noun for the default summary line, e.g. "user". */
  itemLabel?: string;
  labels?: PaginationBarLabels;
  className?: string;
};

/**
 * The page buttons to show: every page up to seven, otherwise the first and the last page and
 * three around the current one, with "ellipsis" for the gaps.
 */
export const pageItems = (page: number, totalPages: number): (number | "ellipsis")[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(2, Math.min(page - 1, totalPages - 3));
  const end = Math.min(totalPages - 1, Math.max(page + 1, 4));
  return [
    1,
    ...(start > 2 ? (["ellipsis"] as const) : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < totalPages - 1 ? (["ellipsis"] as const) : []),
    totalPages,
  ];
};

/**
 * Server-side pagination: summary, first / previous / numbered / next / last buttons and a box to
 * jump to a page (Enter). Maps 1:1 onto the API's `PageResult`.
 */
export const PaginationBar = ({
  page,
  totalPages,
  total,
  hasPrev,
  hasNext,
  onPageChange,
  itemLabel = "item",
  labels,
  className,
}: PaginationBarProps) => {
  const [typed, setTyped] = useState("");
  const lastPage = Math.max(1, totalPages);
  const go = (target: number) => {
    const next = Math.min(Math.max(target, 1), lastPage);
    if (next !== page) {
      onPageChange(next);
    }
  };
  const jump = () => {
    const parsed = Number.parseInt(typed, 10);
    if (Number.isInteger(parsed)) {
      go(parsed);
    }
    setTyped("");
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span>
        {labels?.summary
          ? labels.summary({ page, totalPages: lastPage, total })
          : `${String(total)} ${itemLabel}${total === 1 ? "" : "s"} · page ${String(page)} of ${String(lastPage)}`}
      </span>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels?.first ?? "First page"}
            disabled={!hasPrev}
            onClick={() => {
              go(1);
            }}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels?.previous ?? "Previous page"}
            disabled={!hasPrev}
            onClick={() => {
              go(page - 1);
            }}
          >
            <ChevronLeft />
          </Button>
          {pageItems(page, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${String(index)}`} aria-hidden className="px-1">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "ghost"}
                size="icon-sm"
                aria-current={item === page ? "page" : undefined}
                onClick={() => {
                  go(item);
                }}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels?.next ?? "Next page"}
            disabled={!hasNext}
            onClick={() => {
              go(page + 1);
            }}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={labels?.last ?? "Last page"}
            disabled={!hasNext}
            onClick={() => {
              go(lastPage);
            }}
          >
            <ChevronsRight />
          </Button>
          <Input
            aria-label={labels?.pageInput ?? "Go to page"}
            placeholder={labels?.pageInput ?? "Go to page"}
            inputMode="numeric"
            className="ml-1 h-7 w-20"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value.replace(/\D/g, ""));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jump();
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

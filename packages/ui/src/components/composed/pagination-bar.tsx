"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";

import { Button } from "../button";
import { Input } from "../input";

export type PaginationBarLabels = {
  first?: string;
  previous?: string;
  next?: string;
  last?: string;
  /** Accessible name and placeholder of the page-number box. */
  pageInput?: string;
};

export type PaginationBarProps = {
  /** 1-based. */
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
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
 * Server-side pagination as the legacy apps had it: first / previous / numbered / next / last
 * buttons and a box to jump to a page (Enter); nothing while there is one page. The total belongs
 * to the surface around it (`DataTable` shows it next to its title).
 */
export const PaginationBar = ({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPageChange,
  labels,
  className,
}: PaginationBarProps) => {
  const [typed, setTyped] = useState("");
  if (totalPages <= 1) {
    return null;
  }
  const go = (target: number) => {
    const next = Math.min(Math.max(target, 1), totalPages);
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
    <div className={cn("flex flex-wrap items-center gap-1 text-sm", className)}>
      <Button
        variant="ghost"
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
        variant="ghost"
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
          <span
            key={`ellipsis-${String(index)}`}
            aria-hidden
            className="px-1 text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant="ghost"
            size="icon-sm"
            className={cn(item === page && "border-primary text-primary hover:text-primary")}
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
        variant="ghost"
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
        variant="ghost"
        size="icon-sm"
        aria-label={labels?.last ?? "Last page"}
        disabled={!hasNext}
        onClick={() => {
          go(totalPages);
        }}
      >
        <ChevronsRight />
      </Button>
      <Input
        aria-label={labels?.pageInput ?? "Go to page"}
        placeholder={labels?.pageInput ?? "Go to page"}
        inputMode="numeric"
        className="ml-1 h-7 w-16"
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
  );
};

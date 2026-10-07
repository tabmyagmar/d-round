"use client";

import { cn } from "cn";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Separator } from "../separator";

export type FilterPopoverProps = {
  /** How many filters are in effect; shown on the trigger. */
  activeCount: number;
  /**
   * The filter fields, rendered only while the popover is open — pass a `next/dynamic` component
   * so the list page does not load them until they are used. `close` closes the popover.
   */
  children: (close: () => void) => ReactNode;
  /** Clears every filter; renders the footer button when given. */
  onClear?: () => void;
  label?: string;
  clearLabel?: string;
  align?: "start" | "center" | "end";
  className?: string;
};

/** A toolbar's filter button with the number of active filters and its fields in a popover. */
export const FilterPopover = ({
  activeCount,
  children,
  onClear,
  label = "Filters",
  clearLabel = "Clear filters",
  align = "end",
  className,
}: FilterPopoverProps) => {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const active = activeCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant={active ? "default" : "outline"} />}>
        <SlidersHorizontal data-icon="inline-start" />
        {label}
        {active ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("w-72 gap-3 p-3", className)}>
        {open ? (
          <>
            {children(close)}
            {onClear ? (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!active}
                  onClick={() => {
                    onClear();
                    close();
                  }}
                >
                  {clearLabel}
                </Button>
              </>
            ) : null}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

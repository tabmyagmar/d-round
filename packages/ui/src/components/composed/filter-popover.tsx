"use client";

import { cn } from "cn";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { useIsMobile } from "../../hooks/use-mobile";
import { Button } from "../button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "../drawer";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Separator } from "../separator";

export type FilterPopoverProps = {
  /** How many filters are in effect; shown on the trigger. */
  activeCount: number;
  /**
   * The filter fields, rendered only while the popover or drawer is shown — pass a `next/dynamic`
   * component so the list page does not load them until they are used. `close` closes it.
   */
  children: (close: () => void) => ReactNode;
  /** Clears every filter; renders the footer button when given. */
  onClear?: () => void;
  /** The trigger's text (screen readers only below `md`) and the drawer's title. */
  label?: string;
  clearLabel?: string;
  align?: "start" | "center" | "end";
  /** Classes for the popover; the drawer spans the screen. */
  className?: string;
};

// Calls `children` only when Base UI mounts the popup, so the fields stay while it animates closed.
const FilterFields = ({
  render,
  close,
}: {
  render: FilterPopoverProps["children"];
  close: () => void;
}) => render(close);

/**
 * A toolbar's filter button with the number of active filters. Its fields open in a popover, or
 * below `md` in a drawer from the bottom of the screen, where the button shows only its icon.
 */
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
  const isMobile = useIsMobile();
  const close = () => {
    setOpen(false);
  };
  const active = activeCount > 0;

  const trigger = <Button variant={active ? "default" : "outline"} className="max-md:px-2" />;
  const triggerContent = (
    <>
      <SlidersHorizontal data-icon="inline-start" />
      <span className="max-md:sr-only">{label}</span>
      {active ? (
        <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
          {activeCount}
        </span>
      ) : null}
    </>
  );
  const content = (
    <>
      <FilterFields render={children} close={close} />
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
  );

  return isMobile ? (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={trigger}>{triggerContent}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-3 overflow-y-auto p-4 pb-6">{content}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{triggerContent}</PopoverTrigger>
      <PopoverContent align={align} className={cn("w-72 gap-3 p-3", className)}>
        {content}
      </PopoverContent>
    </Popover>
  );
};

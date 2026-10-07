import { cn } from "cn";
import type { ReactNode } from "react";

export type ListToolbarProps = {
  /** Usually a `SearchInput`. */
  search?: ReactNode;
  /** Usually a `FilterPopover`. */
  filters?: ReactNode;
  /** Right-aligned buttons (add, export, …). */
  actions?: ReactNode;
  /** A row under the toolbar, usually `FilterTags`. */
  children?: ReactNode;
  className?: string;
};

/** The bar above a list: search and filters on the left, actions on the right. */
export const ListToolbar = ({
  search,
  filters,
  actions,
  children,
  className,
}: ListToolbarProps) => (
  <div className={cn("flex min-w-0 flex-col gap-2", className)}>
    <div className="flex flex-wrap items-center gap-2">
      {search ? <div className="w-full sm:w-72">{search}</div> : null}
      {filters}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </div>
);

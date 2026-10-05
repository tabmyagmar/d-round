import { cn } from "cn";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** The page's only `h1`. */
  title: string;
  description?: ReactNode;
  /** Buttons or links for the page; aligned right on wide screens. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Title block at the top of a page: `h1`, optional muted description and an actions slot.
 * No hooks and no client boundary, so server components render it directly.
 */
export const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <header
    className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
  >
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>
);

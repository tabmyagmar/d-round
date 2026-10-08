import { cn } from "cn";
import type { ReactNode } from "react";

export type StickyBarProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The bar at the bottom of a page for its main actions (a form's キャンセル / 保存), as romuten-v3's
 * create and update pages. Render it last in a flex column that fills the page: `mt-auto` keeps it
 * at the bottom of a short page, `sticky bottom-0` keeps it in view while a long one scrolls. It
 * reaches across the page gutter the app shell sets (`--page-gutter`), edge to edge, and is white
 * (`bg-card`) so it stands out from the page background, as romuten-v3's contract template form
 * (`ContractTemplateStep1Form`: `sticky bottom-0 border-t bg-white`).
 */
export const StickyBar = ({ children, className }: StickyBarProps) => (
  <div
    data-slot="sticky-bar"
    className={cn(
      "sticky bottom-0 z-10 -mx-(--page-gutter) mt-auto -mb-(--page-gutter) border-t border-border bg-card px-(--page-gutter) py-3",
      className,
    )}
  >
    {children}
  </div>
);

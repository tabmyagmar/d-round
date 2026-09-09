import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

import { Badge } from "../badge";

/**
 * Semantic status pill built on the shadcn Badge. Domain code maps its states to a tone
 * (user roles, outbox status, approval steps) instead of picking colours ad hoc.
 */
const statusBadgeVariants = cva("gap-1.5 font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      info: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
      success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      danger: "bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;

export type StatusBadgeProps = Omit<ComponentProps<typeof Badge>, "variant"> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Small coloured dot in front of the label. */
    dot?: boolean;
  };

export const StatusBadge = ({
  tone,
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) => (
  <Badge variant="outline" className={cn(statusBadgeVariants({ tone }), className)} {...props}>
    {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
    {children}
  </Badge>
);

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
      info: "bg-info/10 text-info",
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
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

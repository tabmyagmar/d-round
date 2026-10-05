import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../empty";

export type EmptyStateProps = {
  /** Usually a lucide icon; rendered muted inside a rounded circle. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** A button or link below the text ("back to home", "retry"). */
  action?: ReactNode;
  className?: string;
};

/**
 * Centered message for a screen without content: placeholders (準備中), 403, 404 and error
 * pages, built on the shadcn `Empty` primitive. The title is an `h2` (`EmptyTitle` is a `div`)
 * so these pages keep a heading. No hooks and no client boundary, so server components render it.
 */
export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <Empty className={className}>
    <EmptyHeader>
      {icon ? (
        <EmptyMedia
          variant="icon"
          aria-hidden
          className="size-12 rounded-full text-muted-foreground [&_svg:not([class*='size-'])]:size-6"
        >
          {icon}
        </EmptyMedia>
      ) : null}
      <EmptyTitle>
        <h2 className="text-lg font-semibold">{title}</h2>
      </EmptyTitle>
      {description ? <EmptyDescription>{description}</EmptyDescription> : null}
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);

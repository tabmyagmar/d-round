import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card";

export type ContentCardProps = {
  /** The heading; an icon or a count badge may sit beside the text. */
  title?: ReactNode;
  description?: ReactNode;
  /** Controls on the right of the header, such as a list's pagination. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * A titled card — every detail, form and list card (legacy `Card` with a `title`, romuten-v3
 * `ContentCard`). The title is semibold in the brand colour, so it stands apart from the values
 * under it as the legacy `text-wb-900` titles did; without a title or actions there is no header.
 */
export const ContentCard = ({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: ContentCardProps) => (
  <Card className={className}>
    {title === undefined && actions === undefined ? null : (
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        {title === undefined ? null : (
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
              {title}
            </CardTitle>
            {description === undefined ? null : <CardDescription>{description}</CardDescription>}
          </div>
        )}
        {actions}
      </CardHeader>
    )}
    <CardContent className={contentClassName}>{children}</CardContent>
  </Card>
);

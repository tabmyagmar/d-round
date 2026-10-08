import { cn } from "cn";
import { Fragment } from "react";
import type { ReactNode } from "react";

export type DescriptionItem = {
  /** Tells apart items that share a label (several memos titled メモ); the label otherwise. */
  key?: string;
  label: string;
  /** `null`, `undefined` and `""` show `emptyText`. */
  value: ReactNode;
};

export type DescriptionListProps = {
  items: readonly DescriptionItem[];
  emptyText?: string;
  className?: string;
};

const isEmpty = (value: ReactNode): boolean =>
  value === null || value === undefined || value === "";

/** Label / value pairs for detail pages (a `<dl>`), one pair per row. */
export const DescriptionList = ({ items, emptyText = "—", className }: DescriptionListProps) => (
  <dl
    className={cn(
      "grid grid-cols-[minmax(6rem,max-content)_1fr] gap-x-6 gap-y-3 text-sm",
      className,
    )}
  >
    {items.map((item) => (
      <Fragment key={item.key ?? item.label}>
        <dt className="text-muted-foreground">{item.label}</dt>
        <dd className="min-w-0 break-words">
          {isEmpty(item.value) ? (
            <span className="text-muted-foreground">{emptyText}</span>
          ) : (
            item.value
          )}
        </dd>
      </Fragment>
    ))}
  </dl>
);

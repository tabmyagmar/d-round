import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../button";

export type SelectionBarProps = {
  /** Rows selected (across pages). */
  count: number;
  onClear: () => void;
  /** The bulk actions for the selection (export, delete, …). */
  children?: ReactNode;
  label?: (count: number) => ReactNode;
  clearLabel?: string;
};

const defaultLabel = (count: number): ReactNode => `${String(count)} selected`;

/** The selected-rows line of a list: the count, its bulk actions and a way to clear it. */
export const SelectionBar = ({
  count,
  onClear,
  children,
  label = defaultLabel,
  clearLabel = "Clear selection",
}: SelectionBarProps) => {
  if (count === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground">
      <span className="font-medium">{label(count)}</span>
      {children}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <X data-icon="inline-start" />
        {clearLabel}
      </Button>
    </div>
  );
};

"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Runs when the item is chosen. */
  onSelect?: () => void;
  /** Renders the item as this element instead, e.g. a link: `<Link href="…" />`. */
  render?: ReactElement;
  destructive?: boolean;
  disabled?: boolean;
};

export type RowActionsProps = {
  /** The actions the user may take; filter out the ones they may not before passing them. */
  actions: readonly RowAction[];
  /** Accessible name of the trigger, e.g. "Actions for Amy". */
  label: string;
  align?: "start" | "center" | "end";
};

/** A table row's "…" menu; the items mount only while it is open. No actions, no menu. */
export const RowActions = ({ actions, label, align = "end" }: RowActionsProps) => {
  if (actions.length === 0) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-44">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            variant={action.destructive ? "destructive" : "default"}
            {...(action.disabled === undefined ? {} : { disabled: action.disabled })}
            {...(action.render ? { render: action.render } : {})}
            {...(action.onSelect ? { onClick: action.onSelect } : {})}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

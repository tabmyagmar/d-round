"use client";

import { cn } from "cn";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";

export type ContentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The body; mounted only while the dialog is open. */
  children?: ReactNode;
  footer?: ReactNode;
  /** Width and other overrides, e.g. `sm:max-w-lg`. */
  className?: string;
  showCloseButton?: boolean;
};

/**
 * A titled dialog with a body and an optional footer — the shell every app dialog uses (forms,
 * pickers, viewers). Render it only when needed (`{open ? <MyDialog /> : null}` or a
 * `next/dynamic` component) so a page does not load dialogs it never opens.
 */
export const ContentDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  showCloseButton = true,
}: ContentDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={cn("sm:max-w-lg", className)} showCloseButton={showCloseButton}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      {open ? children : null}
      {footer ? <DialogFooter>{footer}</DialogFooter> : null}
    </DialogContent>
  </Dialog>
);

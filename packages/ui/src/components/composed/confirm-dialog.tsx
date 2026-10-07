"use client";

import type { ReactNode } from "react";

import { Button } from "../button";
import { DialogClose } from "../dialog";

import { ContentDialog } from "./content-dialog";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `pending`. */
  pendingLabel?: string;
  /** Renders the confirm button in the destructive variant. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
};

/** Controlled confirmation dialog — replaces `window.confirm` for destructive actions. */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pendingLabel = "Working…",
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) => (
  <ContentDialog
    open={open}
    onOpenChange={onOpenChange}
    title={title}
    description={description}
    className="sm:max-w-sm"
    showCloseButton={false}
    footer={
      <>
        <DialogClose render={<Button variant="outline" disabled={pending} />}>
          {cancelLabel}
        </DialogClose>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </>
    }
  />
);

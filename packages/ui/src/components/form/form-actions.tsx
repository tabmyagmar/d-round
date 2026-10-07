import { cn } from "cn";
import type { ReactNode } from "react";

import { Button } from "../button";
import { Spinner } from "../spinner";

export type FormActionsProps = {
  submitLabel: string;
  /** Shown on the submit button while `pending`; defaults to `submitLabel`. */
  pendingLabel?: string;
  /** The submit is in flight: the button shows a spinner and refuses a second click. */
  pending?: boolean;
  /** Blocks the submit for another reason (nothing changed, nothing allowed). */
  disabled?: boolean;
  /** Secondary actions before the submit button, usually キャンセル. */
  children?: ReactNode;
  className?: string;
};

/**
 * A form's action row: the secondary actions, then the submit button, aligned right. Not bound to
 * react-hook-form — the caller passes the mutation's `pending`. Usually inside a `StickyBar`.
 */
export const FormActions = ({
  submitLabel,
  pendingLabel = submitLabel,
  pending = false,
  disabled = false,
  children,
  className,
}: FormActionsProps) => (
  <div
    data-slot="form-actions"
    className={cn("flex flex-wrap items-center justify-end gap-2", className)}
  >
    {children}
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? <Spinner aria-hidden data-icon="inline-start" /> : null}
      {pending ? pendingLabel : submitLabel}
    </Button>
  </div>
);

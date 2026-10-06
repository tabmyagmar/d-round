import { cn } from "cn";
import type { ReactNode } from "react";

import { Spinner } from "../spinner";

export type LoadingStateProps = {
  /** Text under the spinner; it is also what screen readers announce. */
  message?: ReactNode;
  className?: string;
};

/**
 * Centered spinner with a message for content that is still loading: route `loading.tsx` files
 * and client components waiting for a query. One `status` region; the spinner itself is hidden
 * from assistive tech so the message is announced once. Hook-free, so server components render it.
 */
export const LoadingState = ({ message = "Loading…", className }: LoadingStateProps) => (
  <div
    role="status"
    aria-live="polite"
    className={cn("flex flex-col items-center justify-center gap-2 py-12", className)}
  >
    <Spinner aria-hidden className="size-5 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/composed/empty-state";

/**
 * Next hands the error component the thrown value as `unknown` (`ErrorInfo`). An error thrown on
 * the server carries a `digest` that matches the server log; its message is hidden in production.
 */
const digestOf = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string"
    ? error.digest
    : undefined;

/** An error while rendering a page under /admin: shown inside the shell, with a retry. */
const AdminError = ({ error, reset }: { error: unknown; reset: () => void }) => {
  const digest = digestOf(error);
  return (
    <EmptyState
      icon={<TriangleAlert />}
      title="エラーが発生しました"
      description={
        // EmptyDescription is a <p>: block spans, never nested <p> (invalid HTML, hydration error).
        <>
          <span className="block">時間をおいて再度お試しください。</span>
          {digest ? <span className="mt-2 block font-mono text-xs">{digest}</span> : null}
        </>
      }
      action={<Button onClick={reset}>再試行</Button>}
    />
  );
};

export default AdminError;

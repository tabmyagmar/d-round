"use client";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";

import { useTRPC } from "@/lib/trpc/react";

/** Smoke test for the whole chain: browser → tRPC client → Hono → tRPC router. */
export const HealthStatus = () => {
  const trpc = useTRPC();
  const ping = useQuery(trpc.health.ping.queryOptions());

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="font-heading text-sm font-medium">API health (tRPC health.ping)</h2>

      {ping.isPending ? <p className="text-sm text-muted-foreground">Pinging…</p> : null}

      {ping.isError ? (
        <p className="text-sm text-destructive">
          Unreachable: {ping.error.message}
          {ping.error.data?.requestId ? ` (request ${ping.error.data.requestId})` : ""}
        </p>
      ) : null}

      {ping.data ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">status</dt>
          <dd className="font-mono">{ping.data.ok ? "OK" : "FAIL"}</dd>
          <dt className="text-muted-foreground">server time</dt>
          <dd className="font-mono">{ping.data.time.toISOString()}</dd>
          <dt className="text-muted-foreground">request id</dt>
          <dd className="font-mono">{ping.data.requestId}</dd>
        </dl>
      ) : null}

      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void ping.refetch()}
          disabled={ping.isFetching}
        >
          Ping again
        </Button>
      </div>
    </section>
  );
};

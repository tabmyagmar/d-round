"use client";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Skeleton } from "@repo/ui/components/skeleton";

import { GeneralStatusBadge } from "@/components/general-status-badge";
import { BranchDetail } from "@/features/branches/components/detail/branch-detail";
import { useTRPC } from "@/lib/trpc/react";

/**
 * 就業先部署詳細 (read-only, as the legacy BranchContainer, which had no actions: the list's row
 * menu edits and deletes): the branch's name, reading and status, then its four cards.
 */
export const BranchDetailContainer = ({ branchId }: { branchId: string }) => {
  const trpc = useTRPC();
  const branch = useQuery(trpc.branch.byId.queryOptions({ branchId }));

  if (branch.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (branch.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>就業先部署情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{branch.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = branch.data;
  return (
    <>
      {/* The header holds the page's h1 (the route title); the branch shown here is an h2. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate font-heading text-xl font-semibold">{detail.name}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{detail.nameKana}</span>
          <GeneralStatusBadge status={detail.status} />
        </div>
      </div>
      <BranchDetail branch={detail} />
    </>
  );
};

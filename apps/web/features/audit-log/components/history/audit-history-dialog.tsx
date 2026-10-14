"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { AuditEntityType } from "@repo/validation";

import { AuditHistoryList } from "@/features/audit-log/components/history/audit-history-list";
import { useTRPC } from "@/lib/trpc/react";

export type AuditHistoryDialogProps = {
  entityType: AuditEntityType;
  entityId: string;
  onOpenChange: (open: boolean) => void;
};

/** 変更履歴 of one entity, read by cursor while the dialog is open (a drawer below `md`). */
export const AuditHistoryDialog = ({
  entityType,
  entityId,
  onOpenChange,
}: AuditHistoryDialogProps) => {
  const trpc = useTRPC();
  const history = useInfiniteQuery(
    trpc.auditLog.history.infiniteQueryOptions(
      { entityType, entityId },
      { getNextPageParam: (page) => page.nextCursor },
    ),
  );

  return (
    <ResponsiveDialog open onOpenChange={onOpenChange} title="変更履歴" className="sm:max-w-3xl">
      {history.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : history.isError ? (
        <Alert variant="destructive">
          <AlertTitle>変更履歴を読み込めませんでした</AlertTitle>
          <AlertDescription>{history.error.message}</AlertDescription>
        </Alert>
      ) : (
        <AuditHistoryList
          entries={history.data.pages.flatMap((page) => page.items)}
          hasMore={history.hasNextPage}
          loadingMore={history.isFetchingNextPage}
          onMore={() => {
            void history.fetchNextPage();
          }}
        />
      )}
    </ResponsiveDialog>
  );
};

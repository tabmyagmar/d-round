"use client";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { ResponsiveDialog } from "@repo/ui/components/composed/responsive-dialog";
import { Skeleton } from "@repo/ui/components/skeleton";

import { AuditLogDetail } from "@/features/audit-log/components/detail/audit-log-detail";
import { useTRPC } from "@/lib/trpc/react";

export type AuditLogDetailDialogProps = {
  auditLogId: string;
  onOpenChange: (open: boolean) => void;
};

/**
 * ログ詳細: one row with its changed fields, read when the dialog opens (the list rows carry no
 * changes). A bottom drawer below `md`.
 */
export const AuditLogDetailDialog = ({ auditLogId, onOpenChange }: AuditLogDetailDialogProps) => {
  const trpc = useTRPC();
  const log = useQuery(trpc.auditLog.byId.queryOptions({ auditLogId }));

  return (
    <ResponsiveDialog open onOpenChange={onOpenChange} title="ログ詳細" className="sm:max-w-2xl">
      {log.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : log.isError ? (
        <Alert variant="destructive">
          <AlertTitle>ログを読み込めませんでした</AlertTitle>
          <AlertDescription>{log.error.message}</AlertDescription>
        </Alert>
      ) : (
        <AuditLogDetail log={log.data} />
      )}
    </ResponsiveDialog>
  );
};

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { listAuditLogsSchema } from "@repo/validation";

import { AuditLogsTable } from "@/features/audit-log/components/list/audit-logs-table";
import { AuditLogsToolbar } from "@/features/audit-log/components/list/audit-logs-toolbar";
import { auditLogFiltersOf } from "@/features/audit-log/utils/audit-log-filters";
import { parseSearchParams } from "@/hooks/search-params";
import { useSearch } from "@/hooks/use-search";
import { useTableState } from "@/hooks/use-table-state";
import { useTRPC } from "@/lib/trpc/react";

// Loaded when a row's 詳細 is pressed, not with the list.
const AuditLogDetailDialog = dynamic(
  () =>
    import("@/features/audit-log/components/detail/audit-log-detail-dialog").then(
      (module) => module.AuditLogDetailDialog,
    ),
  { ssr: false },
);

/**
 * アクセスログ管理 (docs/adr/0015-audit-log.md): the URL is the list's state (search, filters,
 * page), read through the API's own input schema; the previous page stays on screen while the next
 * one loads. Newest first, never sorted otherwise.
 */
export const AuditLogsContainer = () => {
  const trpc = useTRPC();
  const { searchParams, setMany } = useSearch();
  const input = useMemo(() => parseSearchParams(listAuditLogsSchema, searchParams), [searchParams]);
  const logs = useQuery(
    trpc.auditLog.list.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const { pagination } = useTableState(logs.data);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <AuditLogsToolbar filters={auditLogFiltersOf(input)} onChange={setMany} />
      {logs.isError ? (
        <Alert variant="destructive">
          <AlertTitle>ログを読み込めませんでした</AlertTitle>
          <AlertDescription>{logs.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <AuditLogsTable
        data={logs.data?.items}
        isLoading={logs.isPending}
        pagination={pagination}
        onOpen={(row) => {
          setDetailId(row.id);
        }}
      />
      {detailId ? (
        <AuditLogDetailDialog
          auditLogId={detailId}
          onOpenChange={(open) => {
            if (!open) {
              setDetailId(null);
            }
          }}
        />
      ) : null}
    </div>
  );
};

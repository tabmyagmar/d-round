"use client";

import { Badge } from "@repo/ui/components/badge";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import type { DataTablePagination } from "@repo/ui/components/composed/data-table";
import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import { AUDIT_STATUS_LABELS } from "@repo/validation";

import type { AuditLogRow } from "@/features/audit-log/types";
import {
  actionLabelOf,
  actorLabelOf,
  dayOf,
  entityTypeLabelOf,
  timeOf,
} from "@/features/audit-log/utils/audit-log-labels";

const helper = createDataTableColumns<AuditLogRow>();

/**
 * The legacy ログ履歴 columns — 日付, 時間, 担当者, アクション, ステータス — with 対象 before the
 * status (the brief); the legacy ID and selection columns are gone with its 削除 (ADR 0015).
 */
const AUDIT_LOG_COLUMNS = helper.columns([
  helper.accessor("createdAt", {
    id: "day",
    header: "日付",
    cell: ({ getValue }) => <span className="tabular-nums">{dayOf(getValue())}</span>,
  }),
  helper.accessor("createdAt", {
    id: "time",
    header: "時間",
    cell: ({ getValue }) => <span className="tabular-nums">{timeOf(getValue())}</span>,
  }),
  helper.display({
    id: "actor",
    header: "担当者",
    cell: ({ row }) => actorLabelOf(row.original),
  }),
  helper.display({
    id: "action",
    header: "アクション",
    cell: ({ row }) => <Badge variant="outline">{actionLabelOf(row.original.action)}</Badge>,
  }),
  helper.display({
    id: "target",
    header: "対象",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.entityLabel ?? "—"}</span>
        <span className="text-xs text-muted-foreground">
          {entityTypeLabelOf(row.original.entityType) ?? ""}
        </span>
      </div>
    ),
  }),
  helper.display({
    id: "status",
    header: "ステータス",
    cell: ({ row }) => (
      <StatusBadge tone={row.original.status === "SUCCESS" ? "success" : "danger"}>
        {AUDIT_STATUS_LABELS[row.original.status]}
      </StatusBadge>
    ),
  }),
]);

export type AuditLogsTableProps = {
  data: AuditLogRow[] | undefined;
  isLoading: boolean;
  pagination: DataTablePagination | undefined;
};

export const AuditLogsTable = ({ data, isLoading, pagination }: AuditLogsTableProps) => (
  <DataTable
    title="ログ履歴"
    columns={AUDIT_LOG_COLUMNS}
    data={data}
    isLoading={isLoading}
    emptyMessage="該当するログはありません"
    getRowId={(row) => row.id}
    {...(pagination ? { pagination } : {})}
  />
);

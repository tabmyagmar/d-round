import { ChevronDown } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { StatusBadge } from "@repo/ui/components/composed/status-badge";

import { AuditChanges } from "@/features/audit-log/components/detail/audit-changes";
import type { AuditHistoryPage } from "@/features/audit-log/types";
import {
  actionLabelOf,
  actorLabelOf,
  changesOf,
  dateTimeOf,
} from "@/features/audit-log/utils/audit-log-labels";

type HistoryEntry = AuditHistoryPage["items"][number];

export type AuditHistoryListProps = {
  entries: readonly HistoryEntry[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
};

/**
 * 変更履歴 of one entity, newest first: each entry's 日時, 担当者 and アクション, opening into its
 * changed fields; もっと見る reads the next entries.
 */
export const AuditHistoryList = ({
  entries,
  hasMore,
  loadingMore,
  onMore,
}: AuditHistoryListProps) =>
  entries.length === 0 ? (
    <p className="text-sm text-muted-foreground">変更履歴はありません</p>
  ) : (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Collapsible className="group/entry">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-accent">
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-muted-foreground tabular-nums">
                    {dateTimeOf(entry.createdAt)}
                  </span>
                  <span>{actorLabelOf(entry)}</span>
                  <Badge variant="outline">{actionLabelOf(entry.action)}</Badge>
                  {entry.status === "FAILURE" ? (
                    <StatusBadge tone="danger">エラー</StatusBadge>
                  ) : null}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 transition-transform group-data-open/entry:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-3">
                <AuditChanges entityType={entry.entityType} changes={changesOf(entry.changes)} />
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button variant="outline" onClick={onMore} disabled={loadingMore}>
          {loadingMore ? "読み込み中…" : "もっと見る"}
        </Button>
      ) : null}
    </div>
  );

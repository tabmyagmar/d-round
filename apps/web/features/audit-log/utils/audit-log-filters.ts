import { TIME_ZONE, dayjs } from "@repo/dayjs";
import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import { AUDIT_STATUS_LABELS } from "@repo/validation";
import type { AuditLogStatus, ListAuditLogsQuery } from "@repo/validation";

import { actionLabelOf, entityTypeLabelOf } from "@/features/audit-log/utils/audit-log-labels";
import type { SearchParamValue } from "@/hooks/search-params";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type AuditLogListFilters = {
  search: string;
  actions: string[];
  entityTypes: string[];
  statuses: AuditLogStatus[];
  /** The period's days (`YYYY-MM-DD`, in Japan). */
  from: string | null;
  to: string | null;
};

/** `null` (or an empty list) removes a URL parameter. */
export type AuditLogFilterChanges = Partial<Record<keyof AuditLogListFilters, SearchParamValue>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: AuditLogFilterChanges = {
  actions: null,
  entityTypes: null,
  statuses: null,
  from: null,
  to: null,
};

export const auditLogFiltersOf = (input: Partial<ListAuditLogsQuery>): AuditLogListFilters => ({
  search: input.search ?? "",
  actions: input.actions ?? [],
  entityTypes: input.entityTypes ?? [],
  statuses: input.statuses ?? [],
  from: input.from ?? null,
  to: input.to ?? null,
});

const DAY = "YYYY/MM/DD";

/** The 期間 tag's value: `2026/10/01 〜 2026/10/14`, an open end left empty. */
const periodOf = ({ from, to }: AuditLogListFilters): string =>
  `${from ? dayjs.tz(from, TIME_ZONE).format(DAY) : ""} 〜 ${to ? dayjs.tz(to, TIME_ZONE).format(DAY) : ""}`;

/** One tag per filter in effect, in the popover's order: アクション, 対象, ステータス, 期間. */
export const auditLogFilterTags = (filters: AuditLogListFilters): FilterTag[] => [
  ...(filters.actions.length > 0
    ? [
        {
          key: "actions",
          label: "アクション",
          value: filters.actions.map(actionLabelOf).join("、"),
        },
      ]
    : []),
  ...(filters.entityTypes.length > 0
    ? [
        {
          key: "entityTypes",
          label: "対象",
          value: filters.entityTypes.map((type) => entityTypeLabelOf(type) ?? type).join("、"),
        },
      ]
    : []),
  ...(filters.statuses.length > 0
    ? [
        {
          key: "statuses",
          label: "ステータス",
          value: filters.statuses.map((status) => AUDIT_STATUS_LABELS[status]).join("、"),
        },
      ]
    : []),
  ...(filters.from || filters.to
    ? [{ key: "period", label: "期間", value: periodOf(filters) }]
    : []),
];

/** The URL changes that remove one tag: the 期間 is two parameters. */
export const removalOf = (key: string): AuditLogFilterChanges =>
  key === "period" ? { from: null, to: null } : { [key]: null };

export const activeFilterCount = (filters: AuditLogListFilters): number =>
  auditLogFilterTags(filters).length;

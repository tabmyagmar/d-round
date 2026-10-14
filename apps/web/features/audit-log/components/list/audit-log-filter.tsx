"use client";

import dynamic from "next/dynamic";

import { FilterPopover } from "@repo/ui/components/composed/filter-popover";
import { Skeleton } from "@repo/ui/components/skeleton";

import { activeFilterCount, CLEARED_FILTERS } from "@/features/audit-log/utils/audit-log-filters";
import type {
  AuditLogFilterChanges,
  AuditLogListFilters,
} from "@/features/audit-log/utils/audit-log-filters";

// The fields load when the popover first opens, not with the list.
const AuditLogFilterContent = dynamic(
  () =>
    import("@/features/audit-log/components/list/audit-log-filter-content").then(
      (module) => module.AuditLogFilterContent,
    ),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export type AuditLogFilterProps = {
  filters: AuditLogListFilters;
  onChange: (changes: AuditLogFilterChanges) => void;
};

export const AuditLogFilter = ({ filters, onChange }: AuditLogFilterProps) => (
  <FilterPopover
    label="フィルター"
    clearLabel="フィルタークリア"
    activeCount={activeFilterCount(filters)}
    onClear={() => {
      onChange(CLEARED_FILTERS);
    }}
  >
    {() => <AuditLogFilterContent filters={filters} onChange={onChange} />}
  </FilterPopover>
);

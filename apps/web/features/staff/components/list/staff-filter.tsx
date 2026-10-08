"use client";

import dynamic from "next/dynamic";

import { FilterPopover } from "@repo/ui/components/composed/filter-popover";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { activeFilterCount, CLEARED_FILTERS } from "@/features/staff/utils/staff-filters";
import type { StaffFilterChanges, StaffListFilters } from "@/features/staff/utils/staff-filters";

// The fields load when the popover first opens, not with the list.
const StaffFilterContent = dynamic(
  () =>
    import("@/features/staff/components/list/staff-filter-content").then(
      (module) => module.StaffFilterContent,
    ),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export type StaffFilterProps = {
  filters: StaffListFilters;
  onChange: (changes: StaffFilterChanges) => void;
};

/** Rendered only while the popover is open, so the reference data loads with its fields. */
const StaffFilterBody = ({ filters, onChange }: StaffFilterProps) => {
  const hierarchy = useSourceHierarchy();
  return <StaffFilterContent filters={filters} hierarchy={hierarchy} onChange={onChange} />;
};

export const StaffFilter = ({ filters, onChange }: StaffFilterProps) => (
  <FilterPopover
    label="フィルター"
    clearLabel="フィルタークリア"
    activeCount={activeFilterCount(filters)}
    onClear={() => {
      onChange(CLEARED_FILTERS);
    }}
  >
    {() => <StaffFilterBody filters={filters} onChange={onChange} />}
  </FilterPopover>
);

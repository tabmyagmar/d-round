"use client";

import dynamic from "next/dynamic";

import { FilterPopover } from "@repo/ui/components/composed/filter-popover";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { activeFilterCount, CLEARED_FILTERS } from "@/features/branches/utils/branch-filters";
import type {
  BranchFilterChanges,
  BranchListFilters,
} from "@/features/branches/utils/branch-filters";

// The fields load when the popover first opens, not with the list.
const BranchFilterContent = dynamic(
  () =>
    import("@/features/branches/components/list/branch-filter-content").then(
      (module) => module.BranchFilterContent,
    ),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export type BranchFilterProps = {
  filters: BranchListFilters;
  onChange: (changes: BranchFilterChanges) => void;
};

/** Rendered only while the popover is open, so the reference data loads with its fields. */
const BranchFilterBody = ({ filters, onChange }: BranchFilterProps) => {
  const hierarchy = useSourceHierarchy();
  return <BranchFilterContent filters={filters} hierarchy={hierarchy} onChange={onChange} />;
};

export const BranchFilter = ({ filters, onChange }: BranchFilterProps) => (
  <FilterPopover
    label="フィルター"
    clearLabel="フィルタークリア"
    activeCount={activeFilterCount(filters)}
    onClear={() => {
      onChange(CLEARED_FILTERS);
    }}
  >
    {() => <BranchFilterBody filters={filters} onChange={onChange} />}
  </FilterPopover>
);

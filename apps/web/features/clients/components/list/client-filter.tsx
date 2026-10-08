"use client";

import dynamic from "next/dynamic";

import { FilterPopover } from "@repo/ui/components/composed/filter-popover";
import { Skeleton } from "@repo/ui/components/skeleton";

import { useSourceHierarchy } from "@/components/source/use-source-hierarchy";
import { activeFilterCount, CLEARED_FILTERS } from "@/features/clients/utils/client-filters";
import type {
  ClientFilterChanges,
  ClientListFilters,
} from "@/features/clients/utils/client-filters";

// The fields load when the popover first opens, not with the list.
const ClientFilterContent = dynamic(
  () =>
    import("@/features/clients/components/list/client-filter-content").then(
      (module) => module.ClientFilterContent,
    ),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export type ClientFilterProps = {
  filters: ClientListFilters;
  onChange: (changes: ClientFilterChanges) => void;
};

/** Rendered only while the popover is open, so the reference data loads with its fields. */
const ClientFilterBody = ({ filters, onChange }: ClientFilterProps) => {
  const hierarchy = useSourceHierarchy();
  return <ClientFilterContent filters={filters} hierarchy={hierarchy} onChange={onChange} />;
};

export const ClientFilter = ({ filters, onChange }: ClientFilterProps) => (
  <FilterPopover
    label="フィルター"
    clearLabel="フィルタークリア"
    activeCount={activeFilterCount(filters)}
    onClear={() => {
      onChange(CLEARED_FILTERS);
    }}
  >
    {() => <ClientFilterBody filters={filters} onChange={onChange} />}
  </FilterPopover>
);

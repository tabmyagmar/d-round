"use client";

import dynamic from "next/dynamic";

import { FilterPopover } from "@repo/ui/components/composed/filter-popover";
import { Skeleton } from "@repo/ui/components/skeleton";

import { activeFilterCount, CLEARED_FILTERS } from "@/features/users/utils/user-filters";
import type { UserFilterChanges, UserListFilters } from "@/features/users/utils/user-filters";

// The fields load when the popover first opens, not with the list.
const UserFilterContent = dynamic(
  () =>
    import("@/features/users/components/list/user-filter-content").then(
      (module) => module.UserFilterContent,
    ),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export type UserFilterProps = {
  filters: UserListFilters;
  onChange: (changes: UserFilterChanges) => void;
};

export const UserFilter = ({ filters, onChange }: UserFilterProps) => (
  <FilterPopover
    label="フィルター"
    clearLabel="フィルタークリア"
    activeCount={activeFilterCount(filters)}
    onClear={() => {
      onChange(CLEARED_FILTERS);
    }}
  >
    {() => <UserFilterContent filters={filters} onChange={onChange} />}
  </FilterPopover>
);

"use client";

import { CheckboxGroup } from "@repo/ui/components/composed/checkbox-group";
import type { GeneralStatus } from "@repo/validation";

import { HierarchyFilterFields } from "@/components/source/hierarchy-filter-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type {
  BranchFilterChanges,
  BranchListFilters,
} from "@/features/branches/utils/branch-filters";
import { GENERAL_STATUS_OPTIONS } from "@/lib/general-status-labels";

export type BranchFilterContentProps = {
  filters: BranchListFilters;
  hierarchy: SourceHierarchy;
  onChange: (changes: BranchFilterChanges) => void;
};

/**
 * The filter popover's fields, in the legacy order: ステータス, エリア, 地域. No ステータス ticked
 * lists 利用中 and 保留 (the API default). Loaded with `next/dynamic` when the popover first opens.
 */
export const BranchFilterContent = ({ filters, hierarchy, onChange }: BranchFilterContentProps) => (
  <div className="flex flex-col gap-3">
    <CheckboxGroup
      label="ステータス"
      options={GENERAL_STATUS_OPTIONS}
      value={filters.statuses}
      onValueChange={(statuses: GeneralStatus[]) => {
        onChange({ statuses });
      }}
      orientation="horizontal"
    />
    <HierarchyFilterFields
      hierarchy={hierarchy}
      selection={{ areas: filters.areas, regionCodes: filters.regionCodes, prefectureCodes: [] }}
      onChange={({ areas, regionCodes }) => {
        onChange({ areas, regionCodes });
      }}
    />
  </div>
);

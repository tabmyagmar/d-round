"use client";

import { MultiOptionSelect } from "@repo/ui/components/composed/multi-option-select";
import { OptionSelect } from "@repo/ui/components/composed/option-select";
import { ROLES, USER_STATUSES } from "@repo/validation";
import type { Position } from "@repo/validation";

import { HierarchyFilterFields } from "@/components/source/hierarchy-filter-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type { UserFilterChanges, UserListFilters } from "@/features/users/utils/user-filters";
import {
  POSITION_OPTIONS,
  ROLE_LABELS,
  USER_STATUS_LABELS,
} from "@/features/users/utils/user-labels";

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const STATUS_OPTIONS = USER_STATUSES.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status],
}));

export type UserFilterContentProps = {
  filters: UserListFilters;
  hierarchy: SourceHierarchy;
  onChange: (changes: UserFilterChanges) => void;
};

/**
 * The filter popover's fields, in the legacy order: ステータス, エリア, 地域, 役職, アカウントタイプ.
 * Loaded with `next/dynamic` when the popover first opens.
 */
export const UserFilterContent = ({ filters, hierarchy, onChange }: UserFilterContentProps) => (
  <div className="flex flex-col gap-3">
    <OptionSelect
      label="ステータス"
      options={STATUS_OPTIONS}
      value={filters.status}
      onValueChange={(status) => {
        // `active` is the API default, so it stays out of the URL.
        onChange({ status: status === "deactivated" ? status : null });
      }}
    />
    <HierarchyFilterFields
      hierarchy={hierarchy}
      selection={{ areas: filters.areas, regionCodes: filters.regionCodes, prefectureCodes: [] }}
      onChange={({ areas, regionCodes }) => {
        onChange({ areas, regionCodes });
      }}
    />
    <MultiOptionSelect
      label="役職"
      options={POSITION_OPTIONS}
      value={filters.positions}
      onValueChange={(positions: Position[]) => {
        onChange({ positions });
      }}
      placeholder="役職を選択"
      emptyMessage="該当なし"
    />
    <OptionSelect
      label="アカウントタイプ"
      options={ROLE_OPTIONS}
      value={filters.role}
      allOption="すべて"
      onValueChange={(role) => {
        onChange({ role });
      }}
    />
  </div>
);

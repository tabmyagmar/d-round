"use client";

import { CheckboxGroup } from "@repo/ui/components/composed/checkbox-group";
import { MultiOptionSelect } from "@repo/ui/components/composed/multi-option-select";
import type { EmployeeType, Gender, StaffStatus } from "@repo/validation";

import { HierarchyFilterFields } from "@/components/source/hierarchy-filter-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type { StaffFilterChanges, StaffListFilters } from "@/features/staff/utils/staff-filters";
import {
  EMPLOYEE_TYPE_OPTIONS,
  GENDER_OPTIONS,
  STAFF_STATUS_OPTIONS,
} from "@/features/staff/utils/staff-labels";

export type StaffFilterContentProps = {
  filters: StaffListFilters;
  hierarchy: SourceHierarchy;
  onChange: (changes: StaffFilterChanges) => void;
};

/**
 * The filter popover's fields, in the legacy order: ステータス, 性別, エリア, 地域, 県名, 雇用区分.
 * No ステータス ticked lists 利用中 and 保留 (the API default). Loaded with `next/dynamic` when the
 * popover first opens.
 */
export const StaffFilterContent = ({ filters, hierarchy, onChange }: StaffFilterContentProps) => (
  <div className="flex flex-col gap-3">
    <CheckboxGroup
      label="ステータス"
      options={STAFF_STATUS_OPTIONS}
      value={filters.statuses}
      onValueChange={(statuses: StaffStatus[]) => {
        onChange({ statuses });
      }}
      orientation="horizontal"
    />
    <CheckboxGroup
      label="性別"
      options={GENDER_OPTIONS}
      value={filters.genders}
      onValueChange={(genders: Gender[]) => {
        onChange({ genders });
      }}
      orientation="horizontal"
    />
    <HierarchyFilterFields
      hierarchy={hierarchy}
      selection={{
        areas: filters.areas,
        regionCodes: filters.regionCodes,
        prefectureCodes: filters.prefectureCodes,
      }}
      onChange={(selection) => {
        onChange(selection);
      }}
      showPrefectures
    />
    <MultiOptionSelect
      label="雇用区分"
      options={EMPLOYEE_TYPE_OPTIONS}
      value={filters.employeeTypes}
      onValueChange={(employeeTypes: EmployeeType[]) => {
        onChange({ employeeTypes });
      }}
      placeholder="雇用区分を選択"
      emptyMessage="該当なし"
    />
  </div>
);

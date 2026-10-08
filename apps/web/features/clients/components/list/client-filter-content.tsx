"use client";

import { CheckboxGroup } from "@repo/ui/components/composed/checkbox-group";
import type { ClientOrderType, GeneralStatus } from "@repo/validation";

import { HierarchyFilterFields } from "@/components/source/hierarchy-filter-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type {
  ClientFilterChanges,
  ClientListFilters,
} from "@/features/clients/utils/client-filters";
import { CLIENT_ORDER_TYPE_OPTIONS } from "@/features/clients/utils/client-labels";
import { GENERAL_STATUS_OPTIONS } from "@/lib/general-status-labels";

export type ClientFilterContentProps = {
  filters: ClientListFilters;
  hierarchy: SourceHierarchy;
  onChange: (changes: ClientFilterChanges) => void;
};

/**
 * The filter popover's fields, in the legacy order: ステータス, エリア, 地域, 受注区分 (three
 * options, so checkboxes where the legacy had a multi-select). No ステータス ticked lists 利用中 and
 * 保留 (the API default). Loaded with `next/dynamic` when the popover first opens.
 */
export const ClientFilterContent = ({ filters, hierarchy, onChange }: ClientFilterContentProps) => (
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
    <CheckboxGroup
      label="受注区分"
      options={CLIENT_ORDER_TYPE_OPTIONS}
      value={filters.orderTypes}
      onValueChange={(orderTypes: ClientOrderType[]) => {
        onChange({ orderTypes });
      }}
      orientation="horizontal"
    />
  </div>
);

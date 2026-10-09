import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import type { GeneralStatus, ListBranchesQuery, SourceArea } from "@repo/validation";

import { AREA_LABELS } from "@/components/source/source-labels";
import type { SearchParamValue } from "@/hooks/search-params";
import { GENERAL_STATUS_LABELS } from "@/lib/general-status-labels";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type BranchListFilters = {
  search: string;
  statuses: GeneralStatus[];
  areas: SourceArea[];
  regionCodes: number[];
};

/** `null` (or an empty list) removes a URL parameter, so the API default applies. */
export type BranchFilterChanges = Partial<Record<keyof BranchListFilters, SearchParamValue>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: BranchFilterChanges = {
  statuses: null,
  areas: null,
  regionCodes: null,
};

export const branchFiltersOf = (input: Partial<ListBranchesQuery>): BranchListFilters => ({
  search: input.search ?? "",
  statuses: input.statuses ?? [],
  areas: input.areas ?? [],
  regionCodes: input.regionCodes ?? [],
});

/** Names the 地域 codes; a code stands for itself while the names load. */
export type BranchFilterNames = { regions: readonly { code: number; name: string }[] };

/** One tag for a list filter in effect: its values by name, joined. */
const tagOf = <TValue>(
  key: keyof BranchListFilters,
  label: string,
  values: readonly TValue[],
  nameOf: (value: TValue) => string,
): FilterTag[] => (values.length > 0 ? [{ key, label, value: values.map(nameOf).join("、") }] : []);

/**
 * One tag per filter in effect, in the popover's order (the legacy ステータス, エリア, 地域); the
 * search has its own box. Without ステータス the API lists 利用中 and 保留.
 */
export const branchFilterTags = (
  filters: BranchListFilters,
  names: BranchFilterNames,
): FilterTag[] => [
  ...tagOf("statuses", "ステータス", filters.statuses, (status) => GENERAL_STATUS_LABELS[status]),
  ...tagOf("areas", "エリア", filters.areas, (area) => AREA_LABELS[area]),
  ...tagOf(
    "regionCodes",
    "地域",
    filters.regionCodes,
    (code) => names.regions.find((region) => region.code === code)?.name ?? String(code),
  ),
];

export const activeFilterCount = (filters: BranchListFilters): number =>
  branchFilterTags(filters, { regions: [] }).length;

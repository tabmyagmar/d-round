import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import type {
  ClientOrderType,
  GeneralStatus,
  ListClientsQuery,
  SourceArea,
} from "@repo/validation";

import { AREA_LABELS } from "@/components/source/source-labels";
import { CLIENT_ORDER_TYPE_LABELS } from "@/features/clients/utils/client-labels";
import type { SearchParamValue } from "@/hooks/search-params";
import { GENERAL_STATUS_LABELS } from "@/lib/general-status-labels";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type ClientListFilters = {
  search: string;
  statuses: GeneralStatus[];
  areas: SourceArea[];
  regionCodes: number[];
  orderTypes: ClientOrderType[];
};

/** `null` (or an empty list) removes a URL parameter, so the API default applies. */
export type ClientFilterChanges = Partial<Record<keyof ClientListFilters, SearchParamValue>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: ClientFilterChanges = {
  statuses: null,
  areas: null,
  regionCodes: null,
  orderTypes: null,
};

export const clientFiltersOf = (input: Partial<ListClientsQuery>): ClientListFilters => ({
  search: input.search ?? "",
  statuses: input.statuses ?? [],
  areas: input.areas ?? [],
  regionCodes: input.regionCodes ?? [],
  orderTypes: input.orderTypes ?? [],
});

/** Names the 地域 codes; a code stands for itself while the names load. */
export type ClientFilterNames = { regions: readonly { code: number; name: string }[] };

/** One tag for a list filter in effect: its values by name, joined. */
const tagOf = <TValue>(
  key: keyof ClientListFilters,
  label: string,
  values: readonly TValue[],
  nameOf: (value: TValue) => string,
): FilterTag[] => (values.length > 0 ? [{ key, label, value: values.map(nameOf).join("、") }] : []);

/**
 * One tag per filter in effect, in the popover's order (the legacy ステータス, エリア, 地域,
 * 受注区分); the search has its own box. Without ステータス the API lists 利用中 and 保留.
 */
export const clientFilterTags = (
  filters: ClientListFilters,
  names: ClientFilterNames,
): FilterTag[] => [
  ...tagOf("statuses", "ステータス", filters.statuses, (status) => GENERAL_STATUS_LABELS[status]),
  ...tagOf("areas", "エリア", filters.areas, (area) => AREA_LABELS[area]),
  ...tagOf(
    "regionCodes",
    "地域",
    filters.regionCodes,
    (code) => names.regions.find((region) => region.code === code)?.name ?? String(code),
  ),
  ...tagOf("orderTypes", "受注区分", filters.orderTypes, (type) => CLIENT_ORDER_TYPE_LABELS[type]),
];

export const activeFilterCount = (filters: ClientListFilters): number =>
  clientFilterTags(filters, { regions: [] }).length;

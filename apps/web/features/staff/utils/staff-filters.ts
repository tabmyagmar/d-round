import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import type {
  EmployeeType,
  Gender,
  ListStaffsQuery,
  SourceArea,
  StaffStatus,
} from "@repo/validation";

import { AREA_LABELS } from "@/components/source/source-labels";
import {
  EMPLOYEE_TYPE_LABELS,
  GENDER_LABELS,
  STAFF_STATUS_LABELS,
} from "@/features/staff/utils/staff-labels";
import type { SearchParamValue } from "@/hooks/search-params";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type StaffListFilters = {
  search: string;
  statuses: StaffStatus[];
  genders: Gender[];
  areas: SourceArea[];
  regionCodes: number[];
  prefectureCodes: number[];
  employeeTypes: EmployeeType[];
};

/** `null` (or an empty list) removes a URL parameter, so the API default applies. */
export type StaffFilterChanges = Partial<Record<keyof StaffListFilters, SearchParamValue>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: StaffFilterChanges = {
  statuses: null,
  genders: null,
  areas: null,
  regionCodes: null,
  prefectureCodes: null,
  employeeTypes: null,
};

export const staffFiltersOf = (input: Partial<ListStaffsQuery>): StaffListFilters => ({
  search: input.search ?? "",
  statuses: input.statuses ?? [],
  genders: input.genders ?? [],
  areas: input.areas ?? [],
  regionCodes: input.regionCodes ?? [],
  prefectureCodes: input.prefectureCodes ?? [],
  employeeTypes: input.employeeTypes ?? [],
});

/** Names the 地域 and 県名 codes; a code stands for itself while the names load. */
export type StaffFilterNames = {
  regions: readonly { code: number; name: string }[];
  prefectures: readonly { code: number; name: string }[];
};

/** One tag for a list filter in effect: its values by name, joined. */
const tagOf = <TValue>(
  key: keyof StaffListFilters,
  label: string,
  values: readonly TValue[],
  nameOf: (value: TValue) => string,
): FilterTag[] => (values.length > 0 ? [{ key, label, value: values.map(nameOf).join("、") }] : []);

const nameIn =
  (options: readonly { code: number; name: string }[]) =>
  (code: number): string =>
    options.find((option) => option.code === code)?.name ?? String(code);

/**
 * One tag per filter in effect, in the popover's order (the legacy ステータス, 性別, エリア, 地域,
 * 県名, 雇用区分); the search has its own box. Without ステータス the API lists 利用中 and 保留.
 */
export const staffFilterTags = (
  filters: StaffListFilters,
  names: StaffFilterNames,
): FilterTag[] => [
  ...tagOf("statuses", "ステータス", filters.statuses, (status) => STAFF_STATUS_LABELS[status]),
  ...tagOf("genders", "性別", filters.genders, (gender) => GENDER_LABELS[gender]),
  ...tagOf("areas", "エリア", filters.areas, (area) => AREA_LABELS[area]),
  ...tagOf("regionCodes", "地域", filters.regionCodes, nameIn(names.regions)),
  ...tagOf("prefectureCodes", "県名", filters.prefectureCodes, nameIn(names.prefectures)),
  ...tagOf(
    "employeeTypes",
    "雇用区分",
    filters.employeeTypes,
    (type) => EMPLOYEE_TYPE_LABELS[type],
  ),
];

export const activeFilterCount = (filters: StaffListFilters): number =>
  staffFilterTags(filters, { regions: [], prefectures: [] }).length;

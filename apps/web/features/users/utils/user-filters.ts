import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import type { ListUsersQuery, Position, Role, SourceArea, UserStatus } from "@repo/validation";

import { AREA_LABELS } from "@/components/source/source-labels";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/features/users/utils/user-labels";
import type { SearchParamValue } from "@/hooks/search-params";
import { POSITION_LABELS } from "@/lib/position-labels";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type UserListFilters = {
  search: string;
  role: Role | null;
  status: UserStatus;
  areas: SourceArea[];
  regionCodes: number[];
  positions: Position[];
};

/** `null` (or an empty list) removes a URL parameter, so the API default applies (status: active). */
export type UserFilterChanges = Partial<Record<keyof UserListFilters, SearchParamValue>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: UserFilterChanges = {
  role: null,
  status: null,
  areas: null,
  regionCodes: null,
  positions: null,
};

export const userFiltersOf = (input: Partial<ListUsersQuery>): UserListFilters => ({
  search: input.search ?? "",
  role: input.role ?? null,
  status: input.status ?? "active",
  areas: input.areas ?? [],
  regionCodes: input.regionCodes ?? [],
  positions: input.positions ?? [],
});

/**
 * One tag per filter in effect, in the popover's order (the legacy ステータス, エリア, 地域, 役職,
 * アカウントタイプ); the search has its own box. `regions` names the region codes (the code itself
 * while they load).
 */
export const userFilterTags = (
  filters: UserListFilters,
  regions: readonly { code: number; name: string }[],
): FilterTag[] => {
  const regionName = (code: number) =>
    regions.find((region) => region.code === code)?.name ?? String(code);
  return [
    ...(filters.status === "active"
      ? []
      : [{ key: "status", label: "ステータス", value: USER_STATUS_LABELS[filters.status] }]),
    ...(filters.areas.length > 0
      ? [
          {
            key: "areas",
            label: "エリア",
            value: filters.areas.map((area) => AREA_LABELS[area]).join("、"),
          },
        ]
      : []),
    ...(filters.regionCodes.length > 0
      ? [
          {
            key: "regionCodes",
            label: "地域",
            value: filters.regionCodes.map(regionName).join("、"),
          },
        ]
      : []),
    ...(filters.positions.length > 0
      ? [
          {
            key: "positions",
            label: "役職",
            value: filters.positions.map((position) => POSITION_LABELS[position]).join("、"),
          },
        ]
      : []),
    ...(filters.role
      ? [{ key: "role", label: "アカウントタイプ", value: ROLE_LABELS[filters.role] }]
      : []),
  ];
};

export const activeFilterCount = (filters: UserListFilters): number =>
  userFilterTags(filters, []).length;

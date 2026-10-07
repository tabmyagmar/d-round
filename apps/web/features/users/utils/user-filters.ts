import type { FilterTag } from "@repo/ui/components/composed/filter-tags";
import type { ListUsersQuery, Role, UserStatus } from "@repo/validation";

import { ROLE_LABELS, USER_STATUS_LABELS } from "@/features/users/utils/user-labels";

/** The list's filters as the toolbar shows them; the URL holds them (`parseSearchParams`). */
export type UserListFilters = { search: string; role: Role | null; status: UserStatus };

/** `null` removes a URL parameter, so the API default applies (status: active). */
export type UserFilterChanges = Partial<Record<"search" | "role" | "status", string | null>>;

/** Clears the popover's filters; the search box keeps its text. */
export const CLEARED_FILTERS: UserFilterChanges = { role: null, status: null };

export const userFiltersOf = (input: Partial<ListUsersQuery>): UserListFilters => ({
  search: input.search ?? "",
  role: input.role ?? null,
  status: input.status ?? "active",
});

/** The account type and a non-default status count; the search has its own box. */
export const userFilterTags = (filters: UserListFilters): FilterTag[] => [
  ...(filters.role
    ? [{ key: "role", label: "アカウントタイプ", value: ROLE_LABELS[filters.role] }]
    : []),
  ...(filters.status === "active"
    ? []
    : [{ key: "status", label: "ステータス", value: USER_STATUS_LABELS[filters.status] }]),
];

export const activeFilterCount = (filters: UserListFilters): number =>
  userFilterTags(filters).length;

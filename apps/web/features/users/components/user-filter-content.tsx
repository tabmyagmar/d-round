"use client";

import { OptionSelect } from "@repo/ui/components/composed/option-select";
import { ROLES, USER_STATUSES } from "@repo/validation";

import type { UserFilterChanges, UserListFilters } from "@/features/users/utils/user-filters";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/features/users/utils/user-labels";

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const STATUS_OPTIONS = USER_STATUSES.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status],
}));

export type UserFilterContentProps = {
  filters: UserListFilters;
  onChange: (changes: UserFilterChanges) => void;
};

/** The filter popover's fields; loaded with `next/dynamic` when the popover first opens. */
export const UserFilterContent = ({ filters, onChange }: UserFilterContentProps) => (
  <div className="flex flex-col gap-3">
    <OptionSelect
      label="アカウントタイプ"
      options={ROLE_OPTIONS}
      value={filters.role}
      allOption="すべて"
      onValueChange={(role) => {
        onChange({ role });
      }}
    />
    <OptionSelect
      label="ステータス"
      options={STATUS_OPTIONS}
      value={filters.status}
      onValueChange={(status) => {
        // `active` is the API default, so it stays out of the URL.
        onChange({ status: status === "deactivated" ? status : null });
      }}
    />
  </div>
);

"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ROLES, roleSchema, USER_STATUSES } from "@repo/validation";
import type { Role, UserStatus } from "@repo/validation";

import { SearchInput } from "@/components/search-input";
import { href, routes } from "@/config/routes";
import { ROLE_LABELS } from "@/features/users/role-badge";
import { USER_STATUS_LABELS } from "@/features/users/user-status-badge";
import type { SearchParamValue } from "@/hooks/search-params";

export type UserListFilters = { search: string; role: Role | null; status: UserStatus };

const ALL_ROLES = "all";

const roleItems = [
  { value: ALL_ROLES, label: "すべてのアカウントタイプ" },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const statusItems = USER_STATUSES.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status],
}));

export type UsersToolbarProps = {
  filters: UserListFilters;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: Record<string, SearchParamValue>) => void;
};

/** 検索, アカウントタイプ and ステータス filters, and 担当者追加 for those who may create users. */
export const UsersToolbar = ({ filters, onChange }: UsersToolbarProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <SearchInput
      value={filters.search}
      onSearch={(search) => {
        onChange({ search });
      }}
      label="氏名・メールアドレスで検索"
      className="w-full sm:w-72"
    />
    <Select
      items={roleItems}
      value={filters.role ?? ALL_ROLES}
      onValueChange={(value) => {
        onChange({ role: roleSchema.safeParse(value).success ? value : null });
      }}
    >
      <SelectTrigger className="w-48" aria-label="アカウントタイプ">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Select
      items={statusItems}
      value={filters.status}
      onValueChange={(value) => {
        // `active` is the API default, so it stays out of the URL.
        onChange({ status: value === "deactivated" ? value : null });
      }}
    >
      <SelectTrigger className="w-32" aria-label="ステータス">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Can I="create" a="User">
      <Button
        className="ml-auto"
        render={<Link href={href(routes.user.create)} />}
        nativeButton={false}
      >
        <Plus />
        担当者追加
      </Button>
    </Can>
  </div>
);

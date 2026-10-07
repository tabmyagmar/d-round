"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";
import { SelectionBar } from "@repo/ui/components/composed/selection-bar";

import { href, routes } from "@/config/routes";
import { UserFilter } from "@/features/users/components/user-filter";
import { useUsersStore } from "@/features/users/stores/users-store-provider";
import { CLEARED_FILTERS, userFilterTags } from "@/features/users/utils/user-filters";
import type { UserFilterChanges, UserListFilters } from "@/features/users/utils/user-filters";

export type UsersToolbarProps = {
  filters: UserListFilters;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: UserFilterChanges) => void;
};

/**
 * 検索, the filter popover, 担当者追加 for those who may create users, then the active filters and
 * the selected rows (from the users store).
 */
export const UsersToolbar = ({ filters, onChange }: UsersToolbarProps) => {
  const selectedCount = useUsersStore((store) => Object.keys(store.rowSelection).length);
  const clearSelection = useUsersStore((store) => store.clearSelection);
  return (
    <ListToolbar
      search={
        <SearchInput
          value={filters.search}
          onSearch={(search) => {
            onChange({ search });
          }}
          label="氏名・メールアドレスで検索"
        />
      }
      filters={<UserFilter filters={filters} onChange={onChange} />}
      actions={
        // TODO(D_ROUND-TBD): CSV upload / download (legacy CsvMenus, CsvDownloadDialog) — own ticket.
        <Can I="create" a="User">
          <Button render={<Link href={href(routes.user.create)} />} nativeButton={false}>
            <Plus data-icon="inline-start" />
            担当者追加
          </Button>
        </Can>
      }
    >
      <FilterTags
        tags={userFilterTags(filters)}
        onRemove={(key) => {
          onChange({ [key]: null });
        }}
        onClearAll={() => {
          onChange(CLEARED_FILTERS);
        }}
        clearAllLabel="すべてクリア"
        removeLabel={(tag) => `${tag.label}の絞り込みを解除`}
      />
      {/* TODO(D_ROUND-TBD): bulk actions on the selection (CSV export) — own ticket. */}
      <SelectionBar
        count={selectedCount}
        onClear={clearSelection}
        label={(count) => `${String(count)}件選択中`}
        clearLabel="選択解除"
      />
    </ListToolbar>
  );
};

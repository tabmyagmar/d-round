"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { href, routes } from "@/config/routes";
import { UserFilter } from "@/features/users/components/user-filter";
import { CLEARED_FILTERS, userFilterTags } from "@/features/users/utils/user-filters";
import type { UserFilterChanges, UserListFilters } from "@/features/users/utils/user-filters";

export type UsersToolbarProps = {
  filters: UserListFilters;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: UserFilterChanges) => void;
};

/** 検索, the filter popover, 担当者追加 for those who may create users, then the active filters. */
export const UsersToolbar = ({ filters, onChange }: UsersToolbarProps) => (
  <ListToolbar
    search={
      <SearchInput
        value={filters.search}
        onSearch={(search) => {
          onChange({ search });
        }}
        label="氏名・フリガナ・メールアドレスで検索"
      />
    }
    filters={<UserFilter filters={filters} onChange={onChange} />}
    actions={
      // TODO(D_ROUND-TBD): CSV upload / download (legacy CsvMenus, CsvDownloadDialog) — own ticket;
      // the download takes the selected ids from the users store.
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
  </ListToolbar>
);

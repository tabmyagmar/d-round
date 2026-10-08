"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { href, routes } from "@/config/routes";
import { StaffFilter } from "@/features/staff/components/list/staff-filter";
import { CLEARED_FILTERS, staffFilterTags } from "@/features/staff/utils/staff-filters";
import type {
  StaffFilterChanges,
  StaffFilterNames,
  StaffListFilters,
} from "@/features/staff/utils/staff-filters";
import { useRowSelection } from "@/stores/row-selection";

export type StaffsToolbarProps = {
  filters: StaffListFilters;
  /** Names the 地域 and 県名 tags' codes (`useSourceHierarchy`; the codes themselves until loaded). */
  names: StaffFilterNames;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: StaffFilterChanges) => void;
  /** 削除 was pressed with these staff selected; the caller confirms and deletes. */
  onDeleteSelected: (ids: string[]) => void;
};

/**
 * 検索, the filter popover, then 削除 for the selection while 停止 is filtered (legacy
 * `showDelete`) and スタッフ追加, each by ability; the active filters underneath.
 */
export const StaffsToolbar = ({
  filters,
  names,
  onChange,
  onDeleteSelected,
}: StaffsToolbarProps) => {
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const selectedIds = Object.keys(rowSelection);

  return (
    <ListToolbar
      search={
        <SearchInput
          value={filters.search}
          onSearch={(search) => {
            onChange({ search });
          }}
          label="スタッフ番号・氏名・フリガナで検索"
        />
      }
      filters={<StaffFilter filters={filters} onChange={onChange} />}
      actions={
        // TODO(D_ROUND-TBD): CSV upload / download (legacy CsvMenus, CsvDownloadDialog) — own ticket;
        // the download takes the selected ids from the list's row selection (useRowSelection).
        <>
          {filters.statuses.includes("SUSPENDED") ? (
            <Can I="delete" a="Staff">
              <Button
                variant="destructive"
                size="icon"
                aria-label="選択したスタッフを削除"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  onDeleteSelected(selectedIds);
                }}
              >
                <Trash2 />
              </Button>
            </Can>
          ) : null}
          <Can I="create" a="Staff">
            <Button render={<Link href={href(routes.staff.create)} />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              スタッフ追加
            </Button>
          </Can>
        </>
      }
    >
      <FilterTags
        tags={staffFilterTags(filters, names)}
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
};

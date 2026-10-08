"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { href, routes } from "@/config/routes";
import { BranchFilter } from "@/features/branches/components/list/branch-filter";
import { branchFilterTags, CLEARED_FILTERS } from "@/features/branches/utils/branch-filters";
import type {
  BranchFilterChanges,
  BranchFilterNames,
  BranchListFilters,
} from "@/features/branches/utils/branch-filters";
import { useRowSelection } from "@/stores/row-selection";

export type BranchesToolbarProps = {
  filters: BranchListFilters;
  /** Names the 地域 tags' codes (`useSourceHierarchy`; the codes themselves until loaded). */
  names: BranchFilterNames;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: BranchFilterChanges) => void;
  /** 削除 was pressed with these branches selected; the caller confirms and deletes. */
  onDeleteSelected: (ids: string[]) => void;
};

/**
 * 検索, the filter popover, then 削除 for the selection while 停止 is filtered (legacy
 * `showDelete`) and 就業先部署追加, each by ability; the active filters underneath.
 */
export const BranchesToolbar = ({
  filters,
  names,
  onChange,
  onDeleteSelected,
}: BranchesToolbarProps) => {
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
          label="番号・名前・クライアント名で検索"
        />
      }
      filters={<BranchFilter filters={filters} onChange={onChange} />}
      actions={
        // TODO(D_ROUND-TBD): CSV upload / download (legacy CsvMenus, CsvDownloadDialog) — own ticket;
        // the download takes the selected ids from the list's row selection (useRowSelection).
        <>
          {filters.statuses.includes("SUSPENDED") ? (
            <Can I="delete" a="Branch">
              <Button
                variant="destructive"
                size="icon"
                aria-label="選択した就業先部署を削除"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  onDeleteSelected(selectedIds);
                }}
              >
                <Trash2 />
              </Button>
            </Can>
          ) : null}
          <Can I="create" a="Branch">
            <Button render={<Link href={href(routes.branch.create)} />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              就業先部署追加
            </Button>
          </Can>
        </>
      }
    >
      <FilterTags
        tags={branchFilterTags(filters, names)}
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

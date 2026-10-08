"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { href, routes } from "@/config/routes";
import { ClientFilter } from "@/features/clients/components/list/client-filter";
import { CLEARED_FILTERS, clientFilterTags } from "@/features/clients/utils/client-filters";
import type {
  ClientFilterChanges,
  ClientFilterNames,
  ClientListFilters,
} from "@/features/clients/utils/client-filters";
import { useRowSelection } from "@/stores/row-selection";

export type ClientsToolbarProps = {
  filters: ClientListFilters;
  /** Names the 地域 tags' codes (`useSourceHierarchy`; the codes themselves until loaded). */
  names: ClientFilterNames;
  /** URL changes: `null` removes a parameter (the API default applies). */
  onChange: (changes: ClientFilterChanges) => void;
  /** 削除 was pressed with these clients selected; the caller confirms and deletes. */
  onDeleteSelected: (ids: string[]) => void;
};

/**
 * 検索, the filter popover, then 削除 for the selection while 停止 is filtered (legacy
 * `showDelete`) and クライアント追加, each by ability; the active filters underneath.
 */
export const ClientsToolbar = ({
  filters,
  names,
  onChange,
  onDeleteSelected,
}: ClientsToolbarProps) => {
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
          label="クライアント番号・クライアント名・フリガナ・担当者名で検索"
        />
      }
      filters={<ClientFilter filters={filters} onChange={onChange} />}
      actions={
        // TODO(D_ROUND-TBD): CSV upload / download (legacy CsvMenus, CsvDownloadDialog) — own ticket;
        // the download takes the selected ids from the list's row selection (useRowSelection).
        <>
          {filters.statuses.includes("SUSPENDED") ? (
            <Can I="delete" a="Client">
              <Button
                variant="destructive"
                size="icon"
                aria-label="選択したクライアントを削除"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  onDeleteSelected(selectedIds);
                }}
              >
                <Trash2 />
              </Button>
            </Can>
          ) : null}
          <Can I="create" a="Client">
            <Button render={<Link href={href(routes.client.create)} />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              クライアント追加
            </Button>
          </Can>
        </>
      }
    >
      <FilterTags
        tags={clientFilterTags(filters, names)}
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

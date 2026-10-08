"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { useRowSelection } from "@/stores/row-selection";

export type CommentTemplatesToolbarProps = {
  search: string;
  onSearch: (search: string) => void;
  onCreate: () => void;
  /** 削除 was pressed with these templates selected; the caller confirms and deletes. */
  onDeleteSelected: (ids: string[]) => void;
};

/** 検索, then the legacy red 削除 (for the selection) and 新規作成. */
export const CommentTemplatesToolbar = ({
  search,
  onSearch,
  onCreate,
  onDeleteSelected,
}: CommentTemplatesToolbarProps) => {
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const selectedIds = Object.keys(rowSelection);

  return (
    <ListToolbar
      search={<SearchInput value={search} onSearch={onSearch} label="タイトル・テキストで検索" />}
      actions={
        <>
          <Button
            variant="destructive"
            size="icon"
            aria-label="選択した定型文を削除"
            disabled={selectedIds.length === 0}
            onClick={() => {
              onDeleteSelected(selectedIds);
            }}
          >
            <Trash2 />
          </Button>
          <Button onClick={onCreate}>
            <Plus data-icon="inline-start" />
            新規作成
          </Button>
        </>
      }
    />
  );
};

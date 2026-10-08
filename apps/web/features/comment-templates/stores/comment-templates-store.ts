import { createStore } from "zustand/vanilla";

import type { DataTableRowSelectionState } from "@repo/ui/components/composed/data-table";

/**
 * The 定型文管理 list's client state that several components share: the selected rows (by
 * template id, across pages) — written by the table, read by the toolbar's 削除. Search and page
 * are not here: they live in the URL. A copy of the users store; the third list promotes it.
 */
export type CommentTemplatesState = {
  rowSelection: DataTableRowSelectionState;
};

export type CommentTemplatesActions = {
  setRowSelection: (
    updater:
      | DataTableRowSelectionState
      | ((previous: DataTableRowSelectionState) => DataTableRowSelectionState),
  ) => void;
};

export type CommentTemplatesStore = CommentTemplatesState & CommentTemplatesActions;

const INITIAL_STATE: CommentTemplatesState = { rowSelection: {} };

/** One store per mounted list (`CommentTemplatesStoreProvider`), never a module-level singleton. */
export const createCommentTemplatesStore = (initialState: CommentTemplatesState = INITIAL_STATE) =>
  createStore<CommentTemplatesStore>()((set) => ({
    ...initialState,
    setRowSelection: (updater) => {
      set((state) => ({
        rowSelection: typeof updater === "function" ? updater(state.rowSelection) : updater,
      }));
    },
  }));

export type CommentTemplatesStoreApi = ReturnType<typeof createCommentTemplatesStore>;

"use client";

import { createContext, use, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { DataTableRowSelectionState } from "@repo/ui/components/composed/data-table";

/**
 * A list's selected rows (by row id, across pages): the table writes them, the toolbar's bulk
 * actions (削除, the CSV export to come) read them. One store per mounted list, created by its
 * provider; leaving the page drops the selection. Filters, page and sort live in the URL, not here.
 */
export type RowSelectionState = { rowSelection: DataTableRowSelectionState };

export type RowSelectionStore = RowSelectionState & {
  setRowSelection: (
    updater:
      | DataTableRowSelectionState
      | ((previous: DataTableRowSelectionState) => DataTableRowSelectionState),
  ) => void;
};

const NOTHING_SELECTED: RowSelectionState = { rowSelection: {} };

/** A vanilla zustand store; `RowSelectionProvider` creates one per list, never a module singleton. */
export const createRowSelectionStore = (initialState: RowSelectionState = NOTHING_SELECTED) =>
  createStore<RowSelectionStore>()((set) => ({
    ...initialState,
    setRowSelection: (updater) => {
      set((state) => ({
        rowSelection: typeof updater === "function" ? updater(state.rowSelection) : updater,
      }));
    },
  }));

type RowSelectionStoreApi = ReturnType<typeof createRowSelectionStore>;

const RowSelectionContext = createContext<RowSelectionStoreApi | null>(null);

/** Gives one list its selection for as long as it is mounted (created once, lazily). */
export const RowSelectionProvider = ({
  children,
  initialState,
}: {
  children: ReactNode;
  /** For tests. */
  initialState?: RowSelectionState;
}) => {
  const [store] = useState(() => createRowSelectionStore(initialState));
  return <RowSelectionContext value={store}>{children}</RowSelectionContext>;
};

/** Reads the nearest list's selection with a selector, re-rendering only for that slice. */
export const useRowSelection = <T,>(selector: (store: RowSelectionStore) => T): T => {
  const store = use(RowSelectionContext);
  if (!store) {
    throw new Error("useRowSelection must be used inside RowSelectionProvider");
  }
  return useStore(store, selector);
};

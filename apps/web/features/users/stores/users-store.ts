import { createStore } from "zustand/vanilla";

import type { DataTableRowSelectionState } from "@repo/ui/components/composed/data-table";

/**
 * The users list's client state that several components share: the selected rows (by user id,
 * across pages) — written by the table, read by the toolbar's bulk actions to come (CSV export).
 * Filters, page and sort are not here: they live in the URL.
 */
export type UsersState = {
  rowSelection: DataTableRowSelectionState;
};

export type UsersActions = {
  setRowSelection: (
    updater:
      | DataTableRowSelectionState
      | ((previous: DataTableRowSelectionState) => DataTableRowSelectionState),
  ) => void;
};

export type UsersStore = UsersState & UsersActions;

const INITIAL_STATE: UsersState = { rowSelection: {} };

/** One store per mounted list (`UsersStoreProvider`), never a module-level singleton. */
export const createUsersStore = (initialState: UsersState = INITIAL_STATE) =>
  createStore<UsersStore>()((set) => ({
    ...initialState,
    setRowSelection: (updater) => {
      set((state) => ({
        rowSelection: typeof updater === "function" ? updater(state.rowSelection) : updater,
      }));
    },
  }));

export type UsersStoreApi = ReturnType<typeof createUsersStore>;

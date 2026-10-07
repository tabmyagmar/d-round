"use client";

import { createContext, use, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { createUsersStore } from "@/features/users/stores/users-store";
import type { UsersState, UsersStore, UsersStoreApi } from "@/features/users/stores/users-store";

const UsersStoreContext = createContext<UsersStoreApi | null>(null);

/**
 * Gives the users list its own store for as long as it is mounted (created once, lazily); leaving
 * the page drops the selection. `initialState` is for tests.
 */
export const UsersStoreProvider = ({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: UsersState;
}) => {
  const [store] = useState(() => createUsersStore(initialState));
  return <UsersStoreContext value={store}>{children}</UsersStoreContext>;
};

/** Reads from the users store with a selector, so a component re-renders only for its slice. */
export const useUsersStore = <T,>(selector: (store: UsersStore) => T): T => {
  const store = use(UsersStoreContext);
  if (!store) {
    throw new Error("useUsersStore must be used inside UsersStoreProvider");
  }
  return useStore(store, selector);
};

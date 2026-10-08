"use client";

import { createContext, use, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { createCommentTemplatesStore } from "@/features/comment-templates/stores/comment-templates-store";
import type {
  CommentTemplatesState,
  CommentTemplatesStore,
  CommentTemplatesStoreApi,
} from "@/features/comment-templates/stores/comment-templates-store";

const CommentTemplatesStoreContext = createContext<CommentTemplatesStoreApi | null>(null);

/**
 * Gives the 定型文管理 list its own store for as long as it is mounted (created once, lazily);
 * leaving the page drops the selection. `initialState` is for tests.
 */
export const CommentTemplatesStoreProvider = ({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: CommentTemplatesState;
}) => {
  const [store] = useState(() => createCommentTemplatesStore(initialState));
  return <CommentTemplatesStoreContext value={store}>{children}</CommentTemplatesStoreContext>;
};

/** Reads from the store with a selector, so a component re-renders only for its slice. */
export const useCommentTemplatesStore = <T,>(selector: (store: CommentTemplatesStore) => T): T => {
  const store = use(CommentTemplatesStoreContext);
  if (!store) {
    throw new Error("useCommentTemplatesStore must be used inside CommentTemplatesStoreProvider");
  }
  return useStore(store, selector);
};

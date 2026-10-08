import { describe, expect, it } from "vitest";

import { createCommentTemplatesStore } from "@/features/comment-templates/stores/comment-templates-store";

describe("comment templates store", () => {
  it("starts with nothing selected", () => {
    expect(createCommentTemplatesStore().getState().rowSelection).toEqual({});
  });

  it("takes a selection or an updater, as the table reports it", () => {
    const store = createCommentTemplatesStore();

    store.getState().setRowSelection({ a: true });
    store.getState().setRowSelection((previous) => ({ ...previous, b: true }));

    expect(store.getState().rowSelection).toEqual({ a: true, b: true });
  });
});

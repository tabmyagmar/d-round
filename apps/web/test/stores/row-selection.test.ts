import { describe, expect, it } from "vitest";

import { createRowSelectionStore } from "@/stores/row-selection";

describe("row selection store", () => {
  it("starts with nothing selected, or with the given state", () => {
    expect(createRowSelectionStore().getState().rowSelection).toEqual({});
    expect(createRowSelectionStore({ rowSelection: { a: true } }).getState().rowSelection).toEqual({
      a: true,
    });
  });

  it("takes a selection or an updater, as the table reports it", () => {
    const store = createRowSelectionStore();

    store.getState().setRowSelection({ a: true });
    store.getState().setRowSelection((previous) => ({ ...previous, b: true }));

    expect(store.getState().rowSelection).toEqual({ a: true, b: true });
  });

  it("gives every list its own store", () => {
    const users = createRowSelectionStore();
    const staff = createRowSelectionStore();

    users.getState().setRowSelection({ a: true });

    expect(staff.getState().rowSelection).toEqual({});
  });
});

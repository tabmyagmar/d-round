import { describe, expect, it } from "vitest";

import { createUsersStore } from "@/features/users/stores/users-store";

describe("users store", () => {
  it("starts with nothing selected", () => {
    expect(createUsersStore().getState().rowSelection).toEqual({});
  });

  it("takes a selection or an updater, as the table reports it", () => {
    const store = createUsersStore();

    store.getState().setRowSelection({ a: true });
    store.getState().setRowSelection((previous) => ({ ...previous, b: true }));

    expect(store.getState().rowSelection).toEqual({ a: true, b: true });
  });
});

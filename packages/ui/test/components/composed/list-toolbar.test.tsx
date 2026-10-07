import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ListToolbar } from "../../../src/components/composed/list-toolbar";

afterEach(cleanup);

describe("ListToolbar", () => {
  it("lays out search, filters, actions and the row under them", () => {
    render(
      <ListToolbar
        search={<input aria-label="Search" />}
        filters={<button type="button">Filters</button>}
        actions={<button type="button">Add</button>}
      >
        <p>Active filters</p>
      </ListToolbar>,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Filters" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();
    expect(screen.getByText("Active filters")).toBeDefined();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectionBar } from "../../../src/components/composed/selection-bar";

afterEach(cleanup);

describe("SelectionBar", () => {
  it("shows how many rows are selected, the bulk actions and a way to clear", () => {
    const onClear = vi.fn();
    render(
      <SelectionBar count={3} onClear={onClear}>
        <button type="button">Export</button>
      </SelectionBar>,
    );

    expect(screen.getByText("3 selected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Export" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while nothing is selected", () => {
    const { container } = render(<SelectionBar count={0} onClear={vi.fn()} />);

    expect(container.childElementCount).toBe(0);
  });
});

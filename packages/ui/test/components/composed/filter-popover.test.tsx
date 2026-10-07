import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterPopover } from "../../../src/components/composed/filter-popover";

afterEach(cleanup);

describe("FilterPopover", () => {
  it("renders its content only once it is opened", async () => {
    const content = vi.fn(() => <p>Filter fields</p>);
    render(<FilterPopover activeCount={0}>{content}</FilterPopover>);

    expect(content).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(await screen.findByText("Filter fields")).toBeDefined();
  });

  it("shows how many filters are active on the trigger", () => {
    render(<FilterPopover activeCount={2}>{() => null}</FilterPopover>);

    expect(screen.getByRole("button", { name: /Filters/ }).textContent).toContain("2");
  });

  it("clears every filter and closes from the footer", async () => {
    const onClear = vi.fn();
    render(
      <FilterPopover activeCount={1} onClear={onClear} clearLabel="Clear filters">
        {() => <p>Filter fields</p>}
      </FilterPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("hands the content a function that closes the popover", async () => {
    render(
      <FilterPopover activeCount={0}>
        {(close) => (
          <button type="button" onClick={close}>
            Done
          </button>
        )}
      </FilterPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});

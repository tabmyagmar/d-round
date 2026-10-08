import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterPopover } from "../../../src/components/composed/filter-popover";

// jsdom has no matchMedia; useIsMobile subscribes to one and reads the width from innerWidth.
const stubViewport = (width: number) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FilterPopover", () => {
  beforeEach(() => {
    stubViewport(1024);
  });

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

  it("hides the trigger's label below md but keeps it as the accessible name", () => {
    render(<FilterPopover activeCount={0}>{() => null}</FilterPopover>);

    const label = screen.getByText("Filters");
    expect(label.className.split(" ")).toContain("max-md:sr-only");
  });

  describe("on a phone", () => {
    beforeEach(() => {
      stubViewport(375);
    });

    it("opens its content in a drawer titled with the label", async () => {
      render(
        <FilterPopover activeCount={0} label="フィルター">
          {() => <p>Filter fields</p>}
        </FilterPopover>,
      );
      fireEvent.click(screen.getByRole("button", { name: "フィルター" }));

      const drawer = await screen.findByRole("dialog", { name: "フィルター" });
      expect(drawer.textContent).toContain("Filter fields");
    });

    it("clears every filter and closes the drawer from its footer", async () => {
      const onClear = vi.fn();
      render(
        <FilterPopover activeCount={1} onClear={onClear} clearLabel="Clear filters">
          {() => <p>Filter fields</p>}
        </FilterPopover>,
      );
      fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));

      expect(onClear).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /Filters/ }).getAttribute("aria-expanded")).toBe(
        "false",
      );
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StickyBar } from "../../../src/components/composed/sticky-bar";

afterEach(cleanup);

describe("StickyBar", () => {
  it("sticks its content to the bottom of the viewport", () => {
    render(
      <StickyBar>
        <button type="submit">Save</button>
      </StickyBar>,
    );

    const bar = screen.getByRole("button", { name: "Save" }).parentElement;
    const classes = bar?.className.split(" ") ?? [];
    expect(bar?.getAttribute("data-slot")).toBe("sticky-bar");
    expect(classes).toContain("sticky");
    expect(classes).toContain("bottom-0");
  });
});

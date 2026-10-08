import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "../../src/components/button";

afterEach(cleanup);

describe("Button", () => {
  it("gives an outline button the card surface, so it stands out from the page background", () => {
    render(<Button variant="outline">Filters</Button>);

    const classes = screen.getByRole("button", { name: "Filters" }).className.split(" ");
    expect(classes).toContain("bg-card");
    expect(classes).not.toContain("bg-background");
  });

  it("hovers an outline button to the secondary tint, not to muted (the page background)", () => {
    render(<Button variant="outline">Filters</Button>);

    const classes = screen.getByRole("button", { name: "Filters" }).className.split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["hover:bg-secondary", "aria-expanded:bg-secondary"]),
    );
    expect(classes).not.toContain("hover:bg-muted");
    expect(classes).not.toContain("aria-expanded:bg-muted");
  });
});

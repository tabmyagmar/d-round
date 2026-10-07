import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Checkbox } from "../../src/components/checkbox";

afterEach(cleanup);

const icon = () => screen.getByRole("checkbox").querySelector("svg")?.getAttribute("class") ?? "";

describe("Checkbox", () => {
  it("shows a check while checked", () => {
    render(<Checkbox aria-label="Pick" checked />);

    expect(icon()).toContain("lucide-check");
  });

  it("shows a minus, not a check, while indeterminate", () => {
    render(<Checkbox aria-label="Pick" indeterminate />);

    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("mixed");
    expect(icon()).toContain("lucide-minus");
  });
});

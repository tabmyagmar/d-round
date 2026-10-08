import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Stepper } from "../../../src/components/composed/stepper";

afterEach(cleanup);

const STEPS = ["Basics", "Family", "Confirm"];

describe("Stepper", () => {
  it("lists the steps in order and marks the current one", () => {
    render(<Stepper steps={STEPS} current={1} label="Staff form steps" />);

    const list = screen.getByRole("navigation", { name: "Staff form steps" });
    expect(list.textContent).toContain("Basics");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Basics",
      "2Family",
      "3Confirm",
    ]);
    expect(screen.getByText("Family").closest("li")?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Basics").closest("li")?.getAttribute("aria-current")).toBeNull();
  });

  it("makes only the completed steps buttons, handing their index back", () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={STEPS} current={2} onStepClick={onStepClick} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Basics",
      "Family",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Family" }));

    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("renders no buttons without onStepClick", () => {
    render(<Stepper steps={STEPS} current={2} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

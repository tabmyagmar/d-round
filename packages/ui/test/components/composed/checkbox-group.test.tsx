import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckboxGroup } from "../../../src/components/composed/checkbox-group";

afterEach(cleanup);

const OPTIONS = [
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "NORTH", label: "North", disabled: true },
] as const;

describe("CheckboxGroup", () => {
  it("names the group with its label and checks the selected options", () => {
    render(
      <CheckboxGroup label="Areas" options={OPTIONS} value={["WEST"]} onValueChange={vi.fn()} />,
    );

    expect(screen.getByRole("group", { name: "Areas" })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: "West" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "East" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("appends a checked value and removes an unchecked one, keeping unknown values", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CheckboxGroup options={OPTIONS} value={["OLD"]} onValueChange={onValueChange} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "East" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["OLD", "EAST"]);

    rerender(
      <CheckboxGroup options={OPTIONS} value={["OLD", "EAST"]} onValueChange={onValueChange} />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "East" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["OLD"]);
  });

  it("disables an option marked disabled, and every option when the group is disabled", () => {
    const { rerender } = render(
      <CheckboxGroup options={OPTIONS} value={[]} onValueChange={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox", { name: "North" }).hasAttribute("data-disabled")).toBe(
      true,
    );
    expect(screen.getByRole("checkbox", { name: "East" }).hasAttribute("data-disabled")).toBe(
      false,
    );

    rerender(<CheckboxGroup options={OPTIONS} value={[]} onValueChange={vi.fn()} disabled />);
    expect(screen.getByRole("checkbox", { name: "East" }).hasAttribute("data-disabled")).toBe(true);
  });
});

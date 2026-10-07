import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupedCheckboxList } from "../../../src/components/composed/grouped-checkbox-list";

afterEach(cleanup);

const GROUPS = [
  {
    key: "users",
    label: "Users",
    options: [
      { value: "u1", label: "Create users" },
      { value: "u2", label: "Read users", hint: "default" },
    ],
  },
  { key: "clients", label: "Clients", options: [{ value: "c1", label: "Read clients" }] },
];

const box = (name: string) => screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });

describe("GroupedCheckboxList", () => {
  it("groups the options under their labels and ticks the selected ones", () => {
    render(<GroupedCheckboxList groups={GROUPS} value={["u2"]} onValueChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Users" })).toBeDefined();
    expect(box("Read users").getAttribute("aria-checked")).toBe("true");
    expect(box("Create users").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("default")).toBeDefined();
  });

  it("shows a group as partly, fully or not selected", () => {
    render(<GroupedCheckboxList groups={GROUPS} value={["u2", "c1"]} onValueChange={vi.fn()} />);

    expect(box("All Users").getAttribute("aria-checked")).toBe("mixed");
    expect(box("All Clients").getAttribute("aria-checked")).toBe("true");
  });

  it("reports the selection in option order when one option changes", () => {
    const onValueChange = vi.fn();
    render(<GroupedCheckboxList groups={GROUPS} value={["c1"]} onValueChange={onValueChange} />);

    fireEvent.click(box("Read users"));

    expect(onValueChange).toHaveBeenCalledWith(["u2", "c1"]);
  });

  it("selects or clears a whole group from its checkbox", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <GroupedCheckboxList groups={GROUPS} value={["u2"]} onValueChange={onValueChange} />,
    );

    fireEvent.click(box("All Users"));
    expect(onValueChange).toHaveBeenLastCalledWith(["u1", "u2"]);

    rerender(
      <GroupedCheckboxList
        groups={GROUPS}
        value={["u1", "u2", "c1"]}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.click(box("All Users"));
    expect(onValueChange).toHaveBeenLastCalledWith(["c1"]);
  });
});

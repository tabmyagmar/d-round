import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OptionSelect } from "../../../src/components/composed/option-select";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would; `click` alone does not. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
] as const;

describe("OptionSelect", () => {
  it("shows the selected option's label under a visible label", () => {
    render(<OptionSelect label="Role" options={OPTIONS} value="staff" onValueChange={vi.fn()} />);

    expect(screen.getByLabelText("Role").textContent).toContain("Staff");
  });

  it("offers an 'all' option that stands for no value", async () => {
    const onValueChange = vi.fn();
    render(
      <OptionSelect
        label="Role"
        options={OPTIONS}
        value={null}
        allOption="All roles"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByLabelText("Role").textContent).toContain("All roles");

    fireEvent.click(screen.getByLabelText("Role"));
    choose(await screen.findByRole("option", { name: "Admin" }));
    expect(onValueChange).toHaveBeenLastCalledWith("admin");
  });

  it("reports null when the 'all' option is chosen", async () => {
    const onValueChange = vi.fn();
    render(
      <OptionSelect
        label="Role"
        options={OPTIONS}
        value="admin"
        allOption="All roles"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Role"));
    choose(await screen.findByRole("option", { name: "All roles" }));

    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("can keep its label for assistive technology only", () => {
    render(
      <OptionSelect
        label="Role"
        hideLabel
        options={OPTIONS}
        value="admin"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Role").className).toContain("sr-only");
    expect(screen.getByLabelText("Role")).toBeDefined();
  });
});

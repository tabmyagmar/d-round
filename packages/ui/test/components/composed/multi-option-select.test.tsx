import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MultiOptionSelect } from "../../../src/components/composed/multi-option-select";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would; `click` alone does not. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const OPTIONS = [
  { value: "1", label: "Hokkaido" },
  { value: "4", label: "Kanto" },
  { value: "7", label: "Kansai" },
];

const open = (label: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  return input;
};

describe("MultiOptionSelect", () => {
  it("labels its input and shows each selected value as a chip", () => {
    render(
      <MultiOptionSelect
        label="Regions"
        options={OPTIONS}
        value={["4", "99"]}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Regions").tagName).toBe("INPUT");
    expect(screen.getByText("Kanto")).toBeDefined();
    // A value outside the options keeps its chip, labelled with the value itself.
    expect(screen.getByText("99")).toBeDefined();
  });

  it("adds a chosen option to the selection", async () => {
    const onValueChange = vi.fn();
    render(
      <MultiOptionSelect
        label="Regions"
        options={OPTIONS}
        value={["4"]}
        onValueChange={onValueChange}
      />,
    );

    open("Regions");
    choose(await screen.findByRole("option", { name: "Kansai" }));

    expect(onValueChange).toHaveBeenLastCalledWith(["4", "7"]);
  });

  it("ignores choices beyond `max`", async () => {
    const onValueChange = vi.fn();
    render(
      <MultiOptionSelect
        label="Regions"
        options={OPTIONS}
        value={["4"]}
        max={1}
        onValueChange={onValueChange}
      />,
    );

    open("Regions");
    choose(await screen.findByRole("option", { name: "Kansai" }));

    expect(onValueChange).toHaveBeenLastCalledWith(["4"]);
  });

  it("shows the placeholder only while nothing is selected", () => {
    const { rerender } = render(
      <MultiOptionSelect
        label="Regions"
        options={OPTIONS}
        value={[]}
        placeholder="Pick regions"
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Regions").getAttribute("placeholder")).toBe("Pick regions");

    rerender(
      <MultiOptionSelect
        label="Regions"
        options={OPTIONS}
        value={["1"]}
        placeholder="Pick regions"
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Regions").getAttribute("placeholder")).toBeNull();
  });
});

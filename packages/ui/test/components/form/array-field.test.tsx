import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { ArrayField } from "../../../src/components/form/array-field";
import { TextField } from "../../../src/components/form/text-field";

afterEach(cleanup);

type Values = { items: { name: string }[] };

const Harness = ({ hideLabel = false, min }: { hideLabel?: boolean; min?: number }) => {
  const form = useForm<Values>({ defaultValues: { items: [{ name: "First" }] } });
  return (
    <ArrayField
      control={form.control}
      name="items"
      label="Items"
      hideLabel={hideLabel}
      {...(min === undefined ? {} : { min })}
      newItem={() => ({ name: "" })}
      addLabel="Add item"
      renderRow={({ index }) => (
        <TextField control={form.control} name={`items.${index}.name`} label="Name" />
      )}
    />
  );
};

describe("ArrayField", () => {
  it("adds a row with the new item and removes one", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(
      screen.getAllByLabelText("Name").map((input) => (input as HTMLInputElement).value),
    ).toEqual(["First", ""]);

    const [first] = screen.getAllByRole("listitem");
    fireEvent.click(within(first!).getByRole("button", { name: "削除" }));
    expect(
      screen.getAllByLabelText("Name").map((input) => (input as HTMLInputElement).value),
    ).toEqual([""]);
  });

  it("keeps at least min rows", () => {
    render(<Harness min={1} />);

    expect(screen.getByRole("button", { name: "削除" })).toHaveProperty("disabled", true);
  });

  it("names the group with its label, also when the label is hidden under a card title", () => {
    render(<Harness hideLabel />);

    expect(screen.getByRole("group", { name: "Items" })).toBeDefined();
    expect(screen.getByText("Items").closest("legend")?.className).toContain("sr-only");
  });
});

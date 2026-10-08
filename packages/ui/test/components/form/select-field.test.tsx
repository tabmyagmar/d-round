import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { SelectField } from "../../../src/components/form/select-field";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would; `click` alone does not. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const OPTIONS = [
  { value: "4", label: "南関東" },
  { value: "7", label: "関西" },
];

type Values = { regionCode: number | null; area: string };

/** A form host that prints its values. */
const Harness = ({ offered, prune }: { offered: string[]; prune: boolean }) => {
  const form = useForm<Values>({ defaultValues: { regionCode: 4, area: "4" } });
  const values = useWatch({ control: form.control });
  return (
    <>
      <SelectField
        control={form.control}
        name="regionCode"
        label="地域"
        options={OPTIONS.filter((option) => offered.includes(option.value))}
        valueAs="number"
        pruneToOptions={prune}
      />
      <SelectField control={form.control} name="area" label="エリア" options={OPTIONS} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
};

const stored = () => JSON.parse(screen.getByTestId("values").textContent) as unknown;

describe("SelectField", () => {
  it("shows a stored number as its option and stores a number with valueAs='number'", async () => {
    render(<Harness offered={["4", "7"]} prune={false} />);
    expect(screen.getAllByText("南関東")).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("地域"));
    choose(await screen.findByRole("option", { name: "関西" }));

    expect(stored()).toEqual({ regionCode: 7, area: "4" });
  });

  it("keeps a value the options no longer offer until they are authoritative, then clears it", () => {
    const { rerender } = render(
      <StrictMode>
        <Harness offered={[]} prune={false} />
      </StrictMode>,
    );
    expect(stored()).toEqual({ regionCode: 4, area: "4" });

    rerender(
      <StrictMode>
        <Harness offered={["7"]} prune />
      </StrictMode>,
    );

    expect(stored()).toEqual({ regionCode: null, area: "4" });
  });
});

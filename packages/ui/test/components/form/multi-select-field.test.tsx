import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { MultiSelectField } from "../../../src/components/form/multi-select-field";

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

type Values = { regionCodes: number[]; tags: string[] };

/** A form host that prints its values; the open popup hides the rest of the page from roles. */
const Harness = () => {
  const form = useForm<Values>({ defaultValues: { regionCodes: [4], tags: ["4"] } });
  const values = useWatch({ control: form.control });
  return (
    <>
      <MultiSelectField
        control={form.control}
        name="regionCodes"
        label="地域"
        options={OPTIONS}
        valueAs="number"
      />
      <MultiSelectField control={form.control} name="tags" label="タグ" options={OPTIONS} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
};

const open = (label: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
};

describe("MultiSelectField", () => {
  it("stores numbers with valueAs='number' and strings by default", async () => {
    render(<Harness />);
    expect(screen.getAllByText("南関東")).toHaveLength(2);

    open("地域");
    choose(await screen.findByRole("option", { name: "関西" }));
    fireEvent.keyDown(screen.getByLabelText("地域"), { key: "Escape" });
    open("タグ");
    choose(await screen.findByRole("option", { name: "関西" }));

    expect(JSON.parse(screen.getByTestId("values").textContent)).toEqual({
      regionCodes: [4, 7],
      tags: ["4", "7"],
    });
  });
});

/** A dependent select: its options follow `areas`, the field drops what they no longer offer. */
const PruneHarness = ({ offered, prune }: { offered: string[]; prune: boolean }) => {
  const form = useForm<{ regionCodes: number[] }>({ defaultValues: { regionCodes: [4, 7] } });
  const values = useWatch({ control: form.control });
  return (
    <>
      <MultiSelectField
        control={form.control}
        name="regionCodes"
        label="地域"
        options={OPTIONS.filter((option) => offered.includes(option.value))}
        valueAs="number"
        pruneToOptions={prune}
      />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
};

describe("MultiSelectField pruneToOptions", () => {
  const stored = () => JSON.parse(screen.getByTestId("values").textContent) as unknown;

  it("keeps a selection the options no longer offer until they are authoritative", () => {
    render(
      <StrictMode>
        <PruneHarness offered={[]} prune={false} />
      </StrictMode>,
    );

    expect(stored()).toEqual({ regionCodes: [4, 7] });
  });

  it("drops what the options no longer offer once they are", () => {
    const { rerender } = render(
      <StrictMode>
        <PruneHarness offered={["4", "7"]} prune />
      </StrictMode>,
    );
    expect(stored()).toEqual({ regionCodes: [4, 7] });

    rerender(
      <StrictMode>
        <PruneHarness offered={["4"]} prune />
      </StrictMode>,
    );

    expect(stored()).toEqual({ regionCodes: [4] });
  });
});

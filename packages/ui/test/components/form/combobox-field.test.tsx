import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { ComboboxField } from "../../../src/components/form/combobox-field";

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

/**
 * A form host searching as a server would: each search's results arrive a moment later and render
 * the field again with option objects of their own (the fetched rows), the chosen one among them.
 */
const SearchHarness = () => {
  const form = useForm<{ regionCode: string }>({ defaultValues: { regionCode: "4" } });
  const value = useWatch({ control: form.control, name: "regionCode" });
  const [searches, setSearches] = useState<string[]>([]);
  return (
    <>
      <ComboboxField
        control={form.control}
        name="regionCode"
        label="地域"
        options={OPTIONS.map((option) => ({ ...option }))}
        onSearch={(query) => {
          setTimeout(() => {
            setSearches((done) => [...done, query]);
          }, 10);
        }}
        serverFiltered
      />
      <output data-testid="value">{value}</output>
      <output data-testid="searches">{JSON.stringify(searches)}</output>
    </>
  );
};

const open = (input: HTMLElement) => {
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
};

describe("ComboboxField", () => {
  it("keeps a search typed over the chosen value while the results render", async () => {
    render(
      <StrictMode>
        <SearchHarness />
      </StrictMode>,
    );
    const input = screen.getByLabelText("地域");
    expect(input).toHaveProperty("value", "南関東");

    open(input);
    fireEvent.change(input, { target: { value: "関西" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(input).toHaveProperty("value", "関西");
    expect(JSON.parse(screen.getByTestId("searches").textContent)).toEqual(["関西"]);
  });

  it("stores the chosen option's value", async () => {
    render(
      <StrictMode>
        <SearchHarness />
      </StrictMode>,
    );
    const input = screen.getByLabelText("地域");

    open(input);
    choose(await screen.findByRole("option", { name: "関西" }));

    expect(screen.getByTestId("value").textContent).toBe("7");
    expect(input).toHaveProperty("value", "関西");
  });
});

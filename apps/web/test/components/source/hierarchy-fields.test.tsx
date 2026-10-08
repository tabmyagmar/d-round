// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import type { SourceArea } from "@repo/validation";

import { HierarchyFields } from "@/components/source/hierarchy-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";

import { HIERARCHY } from "./hierarchy-fixture";

afterEach(cleanup);

type Values = { areas: SourceArea[]; regionCodes: number[]; prefectureCodes: number[] };

/** A form holding a staff-like selection; it prints its values (an open popup hides roles). */
const Harness = ({ hierarchy }: { hierarchy: SourceHierarchy }) => {
  const form = useForm<Values>({
    defaultValues: { areas: ["EAST"], regionCodes: [4], prefectureCodes: [13] },
  });
  const values = useWatch({ control: form.control });
  return (
    <>
      <HierarchyFields
        control={form.control}
        hierarchy={hierarchy}
        names={{ areas: "areas", regionCodes: "regionCodes", prefectureCodes: "prefectureCodes" }}
      />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
};

const renderFields = (hierarchy: SourceHierarchy) =>
  render(
    <StrictMode>
      <Harness hierarchy={hierarchy} />
    </StrictMode>,
  );

const stored = () => JSON.parse(screen.getByTestId("values").textContent) as unknown;

describe("HierarchyFields", () => {
  it("shows the stored choices with the legacy code - name labels and keeps them", () => {
    renderFields(HIERARCHY);

    expect(screen.getByRole("checkbox", { name: "東日本" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("4 - 南関東")).toBeDefined();
    expect(screen.getByText("13 - 東京都")).toBeDefined();
    expect(stored()).toEqual({ areas: ["EAST"], regionCodes: [4], prefectureCodes: [13] });
  });

  it("offers as 地域 only the regions of the chosen エリア", async () => {
    renderFields(HIERARCHY);

    const input = screen.getByLabelText("地域");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "1 - 北海道" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "7 - 関西" })).toBeNull();
  });

  it("drops the regions and prefectures a removed エリア covered", () => {
    renderFields(HIERARCHY);

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(stored()).toEqual({ areas: [], regionCodes: [], prefectureCodes: [] });
  });

  it("keeps a stored choice while the reference data is still loading", () => {
    renderFields({ regions: [], prefectures: [], ready: false });

    expect(stored()).toEqual({ areas: ["EAST"], regionCodes: [4], prefectureCodes: [13] });
  });
});

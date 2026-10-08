// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HierarchyFilterFields } from "@/components/source/hierarchy-filter-fields";
import type { HierarchySelection } from "@/components/source/hierarchy-options";

import { HIERARCHY } from "./hierarchy-fixture";

afterEach(cleanup);

const WEST_CHOICE: HierarchySelection = { areas: [], regionCodes: [7], prefectureCodes: [27] };

describe("HierarchyFilterFields", () => {
  it("shows the chosen regions and prefectures by name, and 県名 only when asked", () => {
    const { rerender } = render(
      <HierarchyFilterFields hierarchy={HIERARCHY} selection={WEST_CHOICE} onChange={vi.fn()} />,
    );
    expect(screen.getByText("関西")).toBeDefined();
    expect(screen.queryByLabelText("県名")).toBeNull();

    rerender(
      <HierarchyFilterFields
        hierarchy={HIERARCHY}
        selection={WEST_CHOICE}
        onChange={vi.fn()}
        showPrefectures
      />,
    );
    expect(screen.getByLabelText("県名")).toBeDefined();
    expect(screen.getByText("大阪府")).toBeDefined();
  });

  it("drops what a newly chosen エリア does not cover", () => {
    const onChange = vi.fn();
    render(
      <HierarchyFilterFields
        hierarchy={HIERARCHY}
        selection={WEST_CHOICE}
        onChange={onChange}
        showPrefectures
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenLastCalledWith({
      areas: ["EAST"],
      regionCodes: [],
      prefectureCodes: [],
    });
  });

  it("changes only what was touched while the reference data is still loading", () => {
    const onChange = vi.fn();
    render(
      <HierarchyFilterFields
        hierarchy={{ regions: [], prefectures: [], ready: false }}
        selection={WEST_CHOICE}
        onChange={onChange}
        showPrefectures
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenLastCalledWith({ ...WEST_CHOICE, areas: ["EAST"] });
  });
});

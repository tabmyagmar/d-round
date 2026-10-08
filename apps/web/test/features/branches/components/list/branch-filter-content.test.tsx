// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchFilterContent } from "@/features/branches/components/list/branch-filter-content";
import type { BranchListFilters } from "@/features/branches/utils/branch-filters";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

const FILTERS: BranchListFilters = {
  search: "",
  statuses: ["SUSPENDED"],
  areas: [],
  regionCodes: [7],
};

const renderContent = (onChange = vi.fn()) => {
  render(<BranchFilterContent filters={FILTERS} hierarchy={HIERARCHY} onChange={onChange} />);
  return onChange;
};

describe("BranchFilterContent", () => {
  it("shows the filters in effect in the legacy order: ステータス, エリア, 地域", () => {
    renderContent();

    expect(screen.getByRole("checkbox", { name: "停止" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("関西")).toBeDefined();
    const labels = ["ステータス", "エリア", "地域"].map((label) =>
      screen.getByText(label, { selector: "label, legend" }),
    );
    for (const [index, label] of labels.slice(1).entries()) {
      // DOCUMENT_POSITION_FOLLOWING: each label comes after the previous one.
      expect(labels[index]!.compareDocumentPosition(label) & 4).toBe(4);
    }
  });

  it("writes the ticked statuses, and エリア without the regions it does not cover", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "利用中" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { statuses: ["SUSPENDED", "ACTIVE"] });
    expect(onChange).toHaveBeenLastCalledWith({ areas: ["EAST"], regionCodes: [] });
  });
});

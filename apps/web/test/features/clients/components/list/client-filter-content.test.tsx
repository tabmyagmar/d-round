// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientFilterContent } from "@/features/clients/components/list/client-filter-content";
import type { ClientListFilters } from "@/features/clients/utils/client-filters";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

const FILTERS: ClientListFilters = {
  search: "",
  statuses: ["SUSPENDED"],
  areas: [],
  regionCodes: [7],
  orderTypes: ["DISPATCH"],
};

const renderContent = (onChange = vi.fn()) => {
  render(<ClientFilterContent filters={FILTERS} hierarchy={HIERARCHY} onChange={onChange} />);
  return onChange;
};

describe("ClientFilterContent", () => {
  it("shows the filters in effect in the legacy order", () => {
    renderContent();

    expect(screen.getByRole("checkbox", { name: "停止" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "派遣" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("関西")).toBeDefined();
    expect(screen.queryByText("県名")).toBeNull();
    const labels = ["ステータス", "エリア", "地域", "受注区分"].map((label) =>
      screen.getByText(label, { selector: "label, legend" }),
    );
    for (const [index, label] of labels.slice(1).entries()) {
      // DOCUMENT_POSITION_FOLLOWING: each label comes after the previous one.
      expect(labels[index]!.compareDocumentPosition(label) & 4).toBe(4);
    }
  });

  it("writes the ticked statuses and 受注区分", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "保留" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "業務請負" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { statuses: ["SUSPENDED", "INACTIVE"] });
    expect(onChange).toHaveBeenNthCalledWith(2, { orderTypes: ["DISPATCH", "CONTRACT_WORK"] });
  });

  it("writes エリア and drops the regions it does not cover", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenLastCalledWith({ areas: ["EAST"], regionCodes: [] });
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffFilterContent } from "@/features/staff/components/list/staff-filter-content";
import type { StaffListFilters } from "@/features/staff/utils/staff-filters";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const FILTERS: StaffListFilters = {
  search: "",
  statuses: ["SUSPENDED"],
  genders: [],
  areas: [],
  regionCodes: [7],
  prefectureCodes: [27],
  employeeTypes: ["PART_TIME"],
};

const renderContent = (onChange = vi.fn()) => {
  render(<StaffFilterContent filters={FILTERS} hierarchy={HIERARCHY} onChange={onChange} />);
  return onChange;
};

describe("StaffFilterContent", () => {
  it("shows the filters in effect in the legacy order", () => {
    renderContent();

    expect(screen.getByRole("checkbox", { name: "停止" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByText("関西")).toBeDefined();
    expect(screen.getByText("大阪府")).toBeDefined();
    expect(screen.getByText("アルバイト")).toBeDefined();
    const labels = ["ステータス", "性別", "エリア", "地域", "県名", "雇用区分"].map((label) =>
      screen.getByText(label, { selector: "label, legend" }),
    );
    for (const [index, label] of labels.slice(1).entries()) {
      // DOCUMENT_POSITION_FOLLOWING: each label comes after the previous one.
      expect(labels[index]!.compareDocumentPosition(label) & 4).toBe(4);
    }
  });

  it("writes the ticked statuses and genders", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "保留" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "女性" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { statuses: ["SUSPENDED", "INACTIVE"] });
    expect(onChange).toHaveBeenNthCalledWith(2, { genders: ["FEMALE"] });
  });

  it("writes エリア and drops the regions and prefectures it does not cover", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenLastCalledWith({
      areas: ["EAST"],
      regionCodes: [],
      prefectureCodes: [],
    });
  });

  it("writes the chosen employment types", async () => {
    const onChange = renderContent();

    const input = screen.getByLabelText("雇用区分");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    choose(await screen.findByRole("option", { name: "正社員" }));

    expect(onChange).toHaveBeenLastCalledWith({ employeeTypes: ["PART_TIME", "FULL_TIME"] });
  });
});

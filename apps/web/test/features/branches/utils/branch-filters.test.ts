import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  branchFiltersOf,
  branchFilterTags,
} from "@/features/branches/utils/branch-filters";
import type { BranchListFilters } from "@/features/branches/utils/branch-filters";

const DEFAULTS: BranchListFilters = { search: "", statuses: [], areas: [], regionCodes: [] };

const NAMES = {
  regions: [
    { code: 4, name: "南関東" },
    { code: 7, name: "関西" },
  ],
};

describe("branchFiltersOf", () => {
  it("reads the filters from the parsed list input, empty where the URL has none", () => {
    expect(branchFiltersOf({})).toEqual(DEFAULTS);
    expect(
      branchFiltersOf({ search: "3", statuses: ["SUSPENDED"], areas: ["EAST"], regionCodes: [4] }),
    ).toEqual({ search: "3", statuses: ["SUSPENDED"], areas: ["EAST"], regionCodes: [4] });
  });
});

describe("activeFilterCount / branchFilterTags", () => {
  it("counts and labels every filter in effect in the popover's order, never the search", () => {
    const filters: BranchListFilters = {
      search: "3",
      statuses: ["INACTIVE"],
      areas: ["WEST"],
      regionCodes: [4, 7],
    };

    expect(activeFilterCount(filters)).toBe(3);
    expect(branchFilterTags(filters, NAMES)).toEqual([
      { key: "statuses", label: "ステータス", value: "保留" },
      { key: "areas", label: "エリア", value: "西日本" },
      { key: "regionCodes", label: "地域", value: "南関東、関西" },
    ]);
  });

  it("names a region by its code while the names load, and has nothing for the defaults", () => {
    expect(branchFilterTags({ ...DEFAULTS, regionCodes: [7] }, { regions: [] })).toEqual([
      { key: "regionCodes", label: "地域", value: "7" },
    ]);
    expect(activeFilterCount(DEFAULTS)).toBe(0);
  });
});

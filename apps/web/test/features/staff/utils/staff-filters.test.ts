import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  staffFiltersOf,
  staffFilterTags,
} from "@/features/staff/utils/staff-filters";
import type { StaffListFilters } from "@/features/staff/utils/staff-filters";

const DEFAULTS: StaffListFilters = {
  search: "",
  statuses: [],
  genders: [],
  areas: [],
  regionCodes: [],
  prefectureCodes: [],
  employeeTypes: [],
};

const NAMES = {
  regions: [
    { code: 4, name: "南関東" },
    { code: 7, name: "関西" },
  ],
  prefectures: [{ code: 13, name: "東京都" }],
};

describe("staffFiltersOf", () => {
  it("reads the filters from the parsed list input, empty where the URL has none", () => {
    expect(staffFiltersOf({})).toEqual(DEFAULTS);
    expect(
      staffFiltersOf({
        search: "12",
        statuses: ["SUSPENDED"],
        genders: ["FEMALE"],
        areas: ["EAST"],
        regionCodes: [4],
        prefectureCodes: [13],
        employeeTypes: ["PART_TIME"],
      }),
    ).toEqual({
      search: "12",
      statuses: ["SUSPENDED"],
      genders: ["FEMALE"],
      areas: ["EAST"],
      regionCodes: [4],
      prefectureCodes: [13],
      employeeTypes: ["PART_TIME"],
    });
  });
});

describe("activeFilterCount / staffFilterTags", () => {
  it("counts and labels every filter in effect in the popover's order, never the search", () => {
    const filters: StaffListFilters = {
      search: "12",
      statuses: ["ACTIVE", "SUSPENDED"],
      genders: ["MALE"],
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
      prefectureCodes: [13],
      employeeTypes: ["FULL_TIME", "OTHER"],
    };

    expect(activeFilterCount(filters)).toBe(6);
    expect(staffFilterTags(filters, NAMES)).toEqual([
      { key: "statuses", label: "ステータス", value: "利用中、停止" },
      { key: "genders", label: "性別", value: "男性" },
      { key: "areas", label: "エリア", value: "東日本、西日本" },
      { key: "regionCodes", label: "地域", value: "南関東、関西" },
      { key: "prefectureCodes", label: "県名", value: "東京都" },
      { key: "employeeTypes", label: "雇用区分", value: "正社員、その他" },
    ]);
  });

  it("names a region or prefecture by its code while the names load", () => {
    expect(
      staffFilterTags(
        { ...DEFAULTS, regionCodes: [4], prefectureCodes: [13] },
        { regions: [], prefectures: [] },
      ),
    ).toEqual([
      { key: "regionCodes", label: "地域", value: "4" },
      { key: "prefectureCodes", label: "県名", value: "13" },
    ]);
  });

  it("has nothing to show for the defaults", () => {
    expect(activeFilterCount(DEFAULTS)).toBe(0);
    expect(staffFilterTags(DEFAULTS, NAMES)).toEqual([]);
  });
});

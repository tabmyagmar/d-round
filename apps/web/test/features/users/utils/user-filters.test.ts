import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  userFiltersOf,
  userFilterTags,
} from "@/features/users/utils/user-filters";
import type { UserListFilters } from "@/features/users/utils/user-filters";

const DEFAULTS: UserListFilters = {
  search: "",
  role: null,
  status: "active",
  areas: [],
  regionCodes: [],
  positions: [],
};

const REGIONS = [
  { code: 4, name: "南関東" },
  { code: 7, name: "関西" },
];

describe("userFiltersOf", () => {
  it("reads the filters from the parsed list input, with the API defaults", () => {
    expect(userFiltersOf({})).toEqual(DEFAULTS);
    expect(
      userFiltersOf({
        search: "amy",
        role: "admin",
        status: "deactivated",
        areas: ["EAST"],
        regionCodes: [4],
        positions: ["SV"],
      }),
    ).toEqual({
      search: "amy",
      role: "admin",
      status: "deactivated",
      areas: ["EAST"],
      regionCodes: [4],
      positions: ["SV"],
    });
  });
});

describe("activeFilterCount / userFilterTags", () => {
  it("counts and labels every filter in effect in the popover's order, never the search", () => {
    const filters: UserListFilters = {
      search: "amy",
      role: "admin",
      status: "deactivated",
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
      positions: ["SV", "LEADER"],
    };

    expect(activeFilterCount(filters)).toBe(5);
    expect(userFilterTags(filters, REGIONS)).toEqual([
      { key: "status", label: "ステータス", value: "停止" },
      { key: "areas", label: "エリア", value: "東日本、西日本" },
      { key: "regionCodes", label: "地域", value: "南関東、関西" },
      { key: "positions", label: "役職", value: "AM、リーダー" },
      { key: "role", label: "アカウントタイプ", value: "アドミン" },
    ]);
  });

  it("names a region by its code while the names load", () => {
    expect(userFilterTags({ ...DEFAULTS, regionCodes: [4] }, [])).toEqual([
      { key: "regionCodes", label: "地域", value: "4" },
    ]);
  });

  it("has nothing to show for the defaults", () => {
    expect(activeFilterCount(DEFAULTS)).toBe(0);
    expect(userFilterTags(DEFAULTS, REGIONS)).toEqual([]);
  });
});

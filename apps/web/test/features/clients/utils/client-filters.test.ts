import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  clientFiltersOf,
  clientFilterTags,
} from "@/features/clients/utils/client-filters";
import type { ClientListFilters } from "@/features/clients/utils/client-filters";

const DEFAULTS: ClientListFilters = {
  search: "",
  statuses: [],
  areas: [],
  regionCodes: [],
  orderTypes: [],
};

const NAMES = {
  regions: [
    { code: 4, name: "南関東" },
    { code: 7, name: "関西" },
  ],
};

describe("clientFiltersOf", () => {
  it("reads the filters from the parsed list input, empty where the URL has none", () => {
    expect(clientFiltersOf({})).toEqual(DEFAULTS);
    expect(
      clientFiltersOf({
        search: "12",
        statuses: ["SUSPENDED"],
        areas: ["EAST"],
        regionCodes: [4],
        orderTypes: ["DISPATCH"],
      }),
    ).toEqual({
      search: "12",
      statuses: ["SUSPENDED"],
      areas: ["EAST"],
      regionCodes: [4],
      orderTypes: ["DISPATCH"],
    });
  });
});

describe("activeFilterCount / clientFilterTags", () => {
  it("counts and labels every filter in effect in the popover's order, never the search", () => {
    const filters: ClientListFilters = {
      search: "12",
      statuses: ["ACTIVE", "SUSPENDED"],
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
      orderTypes: ["CONTRACT_WORK", "SPOT_WORK"],
    };

    expect(activeFilterCount(filters)).toBe(4);
    expect(clientFilterTags(filters, NAMES)).toEqual([
      { key: "statuses", label: "ステータス", value: "利用中、停止" },
      { key: "areas", label: "エリア", value: "東日本、西日本" },
      { key: "regionCodes", label: "地域", value: "南関東、関西" },
      { key: "orderTypes", label: "受注区分", value: "業務請負、スポット" },
    ]);
  });

  it("names a region by its code while the names load, and has nothing for the defaults", () => {
    expect(clientFilterTags({ ...DEFAULTS, regionCodes: [4] }, { regions: [] })).toEqual([
      { key: "regionCodes", label: "地域", value: "4" },
    ]);
    expect(activeFilterCount(DEFAULTS)).toBe(0);
    expect(clientFilterTags(DEFAULTS, NAMES)).toEqual([]);
  });
});

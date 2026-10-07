import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  userFiltersOf,
  userFilterTags,
} from "@/features/users/utils/user-filters";

describe("userFiltersOf", () => {
  it("reads the filters from the parsed list input, with the API defaults", () => {
    expect(userFiltersOf({})).toEqual({ search: "", role: null, status: "active" });
    expect(userFiltersOf({ search: "amy", role: "admin", status: "deactivated" })).toEqual({
      search: "amy",
      role: "admin",
      status: "deactivated",
    });
  });
});

describe("activeFilterCount / userFilterTags", () => {
  it("counts and labels the account type and a non-default status, never the search", () => {
    const filters = { search: "amy", role: "admin", status: "deactivated" } as const;

    expect(activeFilterCount(filters)).toBe(2);
    expect(userFilterTags(filters)).toEqual([
      { key: "role", label: "アカウントタイプ", value: "アドミン" },
      { key: "status", label: "ステータス", value: "停止" },
    ]);
  });

  it("has nothing to show for the defaults", () => {
    const filters = { search: "", role: null, status: "active" } as const;

    expect(activeFilterCount(filters)).toBe(0);
    expect(userFilterTags(filters)).toEqual([]);
  });
});

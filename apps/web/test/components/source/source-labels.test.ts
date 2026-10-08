import { describe, expect, it } from "vitest";

import { SOURCE_AREAS } from "@repo/validation";

import {
  addressLineOf,
  AREA_LABELS,
  areaNamesOf,
  postCodeLabel,
  regionNamesOf,
} from "@/components/source/source-labels";

describe("source labels", () => {
  it("names both areas with the legacy Japanese labels", () => {
    expect(SOURCE_AREAS.map((area) => AREA_LABELS[area])).toEqual(["東日本", "西日本"]);
  });

  it("joins the areas and regions by name", () => {
    expect(areaNamesOf({ areas: ["EAST", "WEST"] })).toBe("東日本、西日本");
    expect(
      regionNamesOf({ regions: [{ region: { name: "南関東" } }, { region: { name: "関西" } }] }),
    ).toBe("南関東、関西");
  });

  it("names nothing without areas or regions, or without a holder (a user without a profile)", () => {
    expect(areaNamesOf({ areas: [] })).toBeNull();
    expect(regionNamesOf({ regions: [] })).toBeNull();
    expect(areaNamesOf(null)).toBeNull();
    expect(regionNamesOf(null)).toBeNull();
  });
});

describe("address labels", () => {
  it("writes a post code with 〒 and the hyphen, stored or typed with it", () => {
    expect(postCodeLabel("1600022")).toBe("〒160-0022");
    expect(postCodeLabel("160-0022")).toBe("〒160-0022");
  });

  it("writes the whole address, the master's part before the typed line", () => {
    expect(
      addressLineOf({
        address1: "1-2-3 新宿ビル",
        sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
      }),
    ).toBe("東京都新宿区新宿1-2-3 新宿ビル");
    expect(addressLineOf(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  codeOptions,
  filterPools,
  nameOptions,
  narrowSelection,
  prefecturesIn,
  regionsIn,
} from "@/components/source/hierarchy-options";

import { HIERARCHY } from "./hierarchy-fixture";

const codes = (items: readonly { code: number }[]) => items.map((item) => item.code);

describe("regionsIn / prefecturesIn", () => {
  it("keeps the regions of the areas and the prefectures of the regions", () => {
    expect(codes(regionsIn(HIERARCHY.regions, ["EAST"]))).toEqual([1, 4]);
    expect(codes(regionsIn(HIERARCHY.regions, []))).toEqual([]);
    expect(codes(prefecturesIn(HIERARCHY.prefectures, [4, 7]))).toEqual([13, 27]);
  });
});

describe("codeOptions / nameOptions", () => {
  it("labels as the legacy forms (code - name) and filters (name) did", () => {
    expect(codeOptions(HIERARCHY.regions.slice(1, 2))).toEqual([
      { value: "4", label: "4 - 南関東" },
    ]);
    expect(nameOptions(HIERARCHY.regions.slice(1, 2))).toEqual([{ value: "4", label: "南関東" }]);
  });
});

describe("filterPools", () => {
  it("offers everything while nothing is chosen", () => {
    const pools = filterPools(HIERARCHY, { areas: [], regionCodes: [] });
    expect(codes(pools.regions)).toEqual([1, 4, 7]);
    expect(codes(pools.prefectures)).toEqual([1, 13, 27]);
  });

  it("narrows regions to the chosen areas and prefectures to the chosen (or pooled) regions", () => {
    expect(codes(filterPools(HIERARCHY, { areas: ["WEST"], regionCodes: [] }).prefectures)).toEqual(
      [27],
    );
    const pools = filterPools(HIERARCHY, { areas: ["EAST"], regionCodes: [4] });
    expect(codes(pools.regions)).toEqual([1, 4]);
    expect(codes(pools.prefectures)).toEqual([13]);
  });
});

describe("narrowSelection", () => {
  it("drops regions and prefectures the new choice no longer covers", () => {
    expect(
      narrowSelection(HIERARCHY, {
        areas: ["EAST"],
        regionCodes: [4, 7],
        prefectureCodes: [13, 27],
      }),
    ).toEqual({ areas: ["EAST"], regionCodes: [4], prefectureCodes: [13] });
    expect(
      narrowSelection(HIERARCHY, { areas: [], regionCodes: [1], prefectureCodes: [13] }),
    ).toEqual({ areas: [], regionCodes: [1], prefectureCodes: [] });
  });
});

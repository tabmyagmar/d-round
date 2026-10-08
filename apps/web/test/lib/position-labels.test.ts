import { describe, expect, it } from "vitest";

import { POSITIONS } from "@repo/validation";

import { POSITION_LABELS, POSITION_OPTIONS } from "@/lib/position-labels";

describe("position labels", () => {
  it("names every position with the legacy Japanese labels, in the legacy order", () => {
    expect(POSITIONS.map((position) => POSITION_LABELS[position])).toEqual([
      "役員",
      "エリア責任者",
      "地区責任者",
      "AM",
      "リーダー",
      "派遣コーディネーター",
      "正社員",
      "エリア社員",
      "契約社員",
      "請負スタッフ",
      "派遣スタッフ",
      "スタッフ",
      "その他",
    ]);
    expect(POSITION_OPTIONS.map((option) => option.value)).toEqual([...POSITIONS]);
  });
});

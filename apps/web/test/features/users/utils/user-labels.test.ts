import { describe, expect, it } from "vitest";

import { POSITIONS, ROLES, USER_STATUSES } from "@repo/validation";

import {
  areaNamesOf,
  POSITION_LABELS,
  readingOf,
  regionNamesOf,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  userStatusOf,
} from "@/features/users/utils/user-labels";

import { userProfile } from "../fixtures";

describe("user labels", () => {
  it("names every role and status with the legacy Japanese labels", () => {
    expect(ROLES.map((role) => ROLE_LABELS[role])).toEqual([
      "スーパーアドミン",
      "アドミン",
      "マネジャー",
      "AM",
    ]);
    expect(USER_STATUSES.map((status) => USER_STATUS_LABELS[status])).toEqual(["利用中", "停止"]);
  });

  it("names every position with the legacy Japanese labels", () => {
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
  });

  it("names a profile's areas and regions, and nothing without a profile", () => {
    const profile = userProfile({ areas: ["EAST", "WEST"] });

    expect(areaNamesOf(profile)).toBe("東日本、西日本");
    expect(regionNamesOf(profile)).toBe("南関東");
    expect(areaNamesOf(null)).toBeNull();
    expect(regionNamesOf({ ...profile, regions: [] })).toBeNull();
  });

  it("reads a user without deletedAt as active and one with it as deactivated", () => {
    expect(userStatusOf({ deletedAt: null })).toBe("active");
    expect(userStatusOf({ deletedAt: new Date() })).toBe("deactivated");
  });

  it("joins the readings, or has none for a user from before the name parts", () => {
    expect(readingOf({ lastNameKana: "ヤマダ", firstNameKana: "タロウ" })).toBe("ヤマダ タロウ");
    expect(readingOf({ lastNameKana: null, firstNameKana: null })).toBeNull();
  });
});

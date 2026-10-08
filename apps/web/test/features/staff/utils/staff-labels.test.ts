import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_TYPES,
  FAMILY_RELATIONS,
  GENDERS,
  STAFF_MEMO_TYPES,
  STAFF_STATUSES,
} from "@repo/validation";

import {
  EMPLOYEE_TYPE_LABELS,
  FAMILY_RELATION_LABELS,
  GENDER_LABELS,
  STAFF_MEMO_TYPE_LABELS,
  STAFF_STATUS_LABELS,
  staffNameOf,
  staffReadingOf,
} from "@/features/staff/utils/staff-labels";

describe("staff labels", () => {
  it("names every status, gender and employment type with the legacy Japanese labels", () => {
    expect(STAFF_STATUSES.map((status) => STAFF_STATUS_LABELS[status])).toEqual([
      "利用中",
      "保留",
      "停止",
    ]);
    expect(GENDERS.map((gender) => GENDER_LABELS[gender])).toEqual(["男性", "女性", "その他"]);
    expect(EMPLOYEE_TYPES.map((type) => EMPLOYEE_TYPE_LABELS[type])).toEqual([
      "役員",
      "正社員",
      "契約社員",
      "アルバイト",
      "その他",
    ]);
  });

  it("names every relation and memo type with the legacy Japanese labels", () => {
    expect(FAMILY_RELATIONS.map((relation) => FAMILY_RELATION_LABELS[relation])).toEqual([
      "夫",
      "妻",
      "父",
      "母",
      "義父",
      "義母",
      "祖父",
      "祖母",
      "長男",
      "次男",
      "三男",
      "長女",
      "次女",
      "三女",
      "孫",
      "甥",
      "姪",
      "伯父",
      "伯母",
      "叔父",
      "叔母",
      "曽祖父",
      "曽祖母",
    ]);
    expect(STAFF_MEMO_TYPES.map((type) => STAFF_MEMO_TYPE_LABELS[type])).toEqual([
      "スタッフメモ",
      "入退社情報",
      "住所変更",
      "保険関係",
      "その他",
      "メモ",
    ]);
  });

  it("writes the name and the reading family name first", () => {
    const staff = {
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
    };

    expect(staffNameOf(staff)).toBe("山田 花子");
    expect(staffReadingOf(staff)).toBe("ヤマダ ハナコ");
  });
});

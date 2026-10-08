import { describe, expect, it } from "vitest";

import {
  ageOf,
  createStaffSchema,
  listStaffsSchema,
  phoneSchema,
  updateStaffSchema,
} from "../src/staff.schema";

/** The first issue's path and message, or null when the value parses. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => {
  const issue = result.error?.issues[0];
  return issue ? { path: issue.path.join("."), message: issue.message } : null;
};

const STAFF = {
  employeeType: "FULL_TIME",
  employeeNumber: 1001,
  lastName: "山田",
  firstName: "花子",
  lastNameKana: "ヤマダ",
  firstNameKana: "ハナコ",
  gender: "FEMALE",
  birthday: "1990-04-01",
  position: "STAFF",
  branchName: " 新宿支店 ",
  email: null,
  phoneNumber: "090-1234-5678",
  emergencyPhoneNumber: null,
  areas: ["WEST", "EAST"],
  regionCodes: [7, 4, 4],
  prefectureCodes: [27, 13],
  chargerUserIds: ["019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f", "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f"],
  address: { postCode: "160-0022", address1: "新宿1-2-3" },
  jobHistories: [{ hireDate: "2020-04-01", resignationDate: null, resignationReason: null }],
  familyMembers: [
    {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: null,
      firstNameKana: null,
      relation: "HUSBAND",
      birthday: null,
    },
  ],
  memos: [{ memoType: "STAFF_MEMO", content: "" }],
};

describe("createStaffSchema", () => {
  it("takes the legacy form's fields: trimmed, codes and areas ordered, ids distinct, post code digits", () => {
    const parsed = createStaffSchema.parse(STAFF);

    expect(parsed).toMatchObject({
      branchName: "新宿支店",
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
      prefectureCodes: [13, 27],
      chargerUserIds: ["019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f"],
      address: { postCode: "1600022", address1: "新宿1-2-3" },
    });
    expect(updateStaffSchema.safeParse({ ...STAFF, staffId: crypto.randomUUID() }).success).toBe(
      true,
    );
  });

  it.each([
    [{ employeeType: undefined }, "employeeType", "雇用区分を選択してください"],
    [{ employeeNumber: null }, "employeeNumber", "スタッフ番号は必須です"],
    [{ gender: undefined }, "gender", "性別を選択してください"],
    [{ birthday: undefined }, "birthday", "生年月日を入力してください"],
    [{ birthday: "2020-01-01" }, "birthday", "16歳以上である必要があります。"],
    [{ position: undefined }, "position", "役職を選択してください"],
    [{ branchName: "" }, "branchName", "支店名を入力してください"],
    [{ email: "taro" }, "email", "正しいメールアドレスを入力してください"],
    [{ phoneNumber: "12345" }, "phoneNumber", "電話番号を入力してください"],
    [{ areas: [] }, "areas", "エリアを選択してください"],
    [{ regionCodes: [] }, "regionCodes", "地域を選択してください"],
    [{ prefectureCodes: [] }, "prefectureCodes", "都道府県を選択してください"],
    [{ chargerUserIds: [] }, "chargerUserIds", "担当者を選択してください"],
    [
      { address: { postCode: "160", address1: "x" } },
      "address.postCode",
      "正しい郵便番号を入力してください",
    ],
    [
      { address: { postCode: "160-0022", address1: " " } },
      "address.address1",
      "住所を入力してください",
    ],
  ])("refuses %j with the legacy message", (change, path, message) => {
    expect(firstIssue(createStaffSchema.safeParse({ ...STAFF, ...change }))).toEqual({
      path,
      message,
    });
  });

  it("requires a family member's 姓 and 名 and full-width katakana readings", () => {
    const member = { ...STAFF.familyMembers[0], lastName: "", firstNameKana: "たろう" };
    const issues = createStaffSchema.safeParse({ ...STAFF, familyMembers: [member] }).error?.issues;

    expect(issues?.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["familyMembers.0.lastName", "姓を入力してください"],
      ["familyMembers.0.firstNameKana", "全角カタカナで入力してください"],
    ]);
  });

  it("asks for a job history's 入社日", () => {
    expect(
      firstIssue(
        createStaffSchema.safeParse({
          ...STAFF,
          jobHistories: [{ hireDate: undefined, resignationDate: null, resignationReason: null }],
        }),
      ),
    ).toEqual({ path: "jobHistories.0.hireDate", message: "日付は必須です" });
  });
});

describe("phoneSchema", () => {
  it.each(["090-1234-5678", "09012345678", "03-1234-5678", "0312345678"])("accepts %s", (value) => {
    expect(phoneSchema.safeParse(value).success).toBe(true);
  });

  it.each(["", "1234567890", "090-1234", "090-1234-56789", "090_1234_5678", "+81-90-1234-5678"])(
    "refuses %j",
    (value) => {
      expect(phoneSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("ageOf", () => {
  it("counts whole years, the birthday itself included", () => {
    const today = new Date(2026, 9, 8);
    expect(ageOf("2010-10-08", today)).toBe(16);
    expect(ageOf("2010-10-09", today)).toBe(15);
    expect(ageOf("1990-04-01", today)).toBe(36);
  });
});

describe("listStaffsSchema", () => {
  it("sorts by スタッフ番号 by default and reads the multi-value filters", () => {
    expect(listStaffsSchema.parse({})).toMatchObject({
      sortBy: "employeeNumber",
      sortOrder: "asc",
    });
    expect(
      listStaffsSchema.parse({
        statuses: ["SUSPENDED"],
        genders: ["FEMALE"],
        regionCodes: ["4"],
        prefectureCodes: ["13"],
        employeeTypes: ["PART_TIME"],
      }),
    ).toMatchObject({ statuses: ["SUSPENDED"], regionCodes: [4], prefectureCodes: [13] });
    expect(listStaffsSchema.safeParse({ statuses: ["DELETED"] }).success).toBe(false);
  });
});

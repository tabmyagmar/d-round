import { describe, expect, it } from "vitest";

import {
  BRANCH_MEMO_MAX,
  branchFormSchema,
  createBranchSchema,
  listBranchesSchema,
  updateBranchSchema,
} from "../src/branch.schema";

/** The first issue's path and message, or null when the value parses. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => {
  const issue = result.error?.issues[0];
  return issue ? { path: issue.path.join("."), message: issue.message } : null;
};

const CHARGER = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f";
const CLIENT = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b60";

const BRANCH = {
  clientId: CLIENT,
  number: 3,
  name: " 新宿店 ",
  nameKana: "シンジュクテン",
  area: "EAST",
  regionCode: 4,
  chargerUserIds: [CHARGER, CHARGER],
  departmentNumber: 10,
  departmentName: "営業部",
  departmentNameKana: "エイギョウブ",
  departmentFax: "0312345679",
  address: { postCode: "160-0022", address1: "新宿1-2-3" },
  contactLastName: "山田",
  contactFirstName: "太郎",
  contactLastNameKana: "ヤマダ",
  contactFirstNameKana: "タロウ",
  contactPosition: "LEADER",
  contactEmail: "yamada@example.com",
  memo: "  ",
};

describe("createBranchSchema", () => {
  it("normalises what the form sends: trimmed text, distinct 担当者, the FAX, no blank memo", () => {
    expect(createBranchSchema.parse(BRANCH)).toEqual({
      ...BRANCH,
      name: "新宿店",
      chargerUserIds: [CHARGER],
      departmentFax: "03-1234-5679",
      address: { postCode: "1600022", address1: "新宿1-2-3" },
      memo: null,
    });
  });

  it("names each missing choice with the legacy message", () => {
    const missing = (key: string, value: unknown) =>
      firstIssue(createBranchSchema.safeParse({ ...BRANCH, [key]: value }));

    expect(missing("clientId", "")).toEqual({
      path: "clientId",
      message: "クライアントを選択してください",
    });
    expect(missing("area", "")).toEqual({ path: "area", message: "エリアを選択してください" });
    expect(missing("regionCode", null)).toEqual({
      path: "regionCode",
      message: "地域を選択してください",
    });
    expect(missing("chargerUserIds", [])).toEqual({
      path: "chargerUserIds",
      message: "担当者を選択してください",
    });
    expect(missing("departmentName", "")).toEqual({
      path: "departmentName",
      message: "部署名を入力してください",
    });
    expect(missing("contactPosition", "")).toEqual({
      path: "contactPosition",
      message: "役職を選択してください",
    });
    expect(missing("contactEmail", "")).toEqual({
      path: "contactEmail",
      message: "メールアドレスを入力してください",
    });
    expect(missing("number", 0)).toEqual({
      path: "number",
      message: "就業先番号は正の整数で入力してください",
    });
  });

  it("bounds the memo and keeps one with text", () => {
    expect(createBranchSchema.parse({ ...BRANCH, memo: " 鍵は受付 " }).memo).toBe("鍵は受付");
    expect(
      firstIssue(
        createBranchSchema.safeParse({ ...BRANCH, memo: "あ".repeat(BRANCH_MEMO_MAX + 1) }),
      ),
    ).toEqual({ path: "memo", message: "メモは2000文字以内で入力してください" });
  });
});

describe("branchFormSchema and updateBranchSchema", () => {
  it("asks the form for the looked-up 住所(県名) and the edit for the branch id", () => {
    expect(
      firstIssue(
        branchFormSchema.safeParse({
          ...BRANCH,
          address: { ...BRANCH.address, pref: "", cityTown: "" },
        }),
      ),
    ).toEqual({ path: "address.pref", message: "郵便番号を入力してください" });
    expect(updateBranchSchema.safeParse(BRANCH).success).toBe(false);
  });
});

describe("listBranchesSchema", () => {
  it("lists by 就業先番号 ascending and reads the filters as the URL carries them", () => {
    expect(listBranchesSchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      sortBy: "number",
      sortOrder: "asc",
    });
    expect(
      listBranchesSchema.parse({
        clientId: CLIENT,
        statuses: ["SUSPENDED"],
        areas: ["WEST"],
        regionCodes: ["7"],
        sortBy: "client",
      }),
    ).toMatchObject({
      clientId: CLIENT,
      statuses: ["SUSPENDED"],
      areas: ["WEST"],
      regionCodes: [7],
      sortBy: "client",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  clientFormSchema,
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
  urlSchema,
} from "../src/client.schema";
import { CHARGERS_MAX } from "../src/user.schema";

/** The first issue's path and message, or null when the value parses. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => {
  const issue = result.error?.issues[0];
  return issue ? { path: issue.path.join("."), message: issue.message } : null;
};

const CHARGER = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f";

const CLIENT = {
  number: 1001,
  name: " 株式会社テスト ",
  nameKana: "カブシキガイシャテスト",
  areas: ["WEST", "EAST"],
  regionCodes: [7, 4, 4],
  chargerUserIds: [CHARGER, CHARGER],
  address: { postCode: "160-0022", address1: "新宿1-2-3" },
  phoneNumber: "０３１２３４５６７８",
  fax: "0312345679",
  webUrl: "example.com",
  orderTypes: ["SPOT_WORK", "CONTRACT_WORK", "SPOT_WORK"],
};

describe("createClientSchema", () => {
  it("normalises what the form sends: trimmed name, ordered sets, national phone formats", () => {
    expect(createClientSchema.parse(CLIENT)).toEqual({
      ...CLIENT,
      name: "株式会社テスト",
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
      chargerUserIds: [CHARGER],
      address: { postCode: "1600022", address1: "新宿1-2-3" },
      phoneNumber: "03-1234-5678",
      fax: "03-1234-5679",
      orderTypes: ["CONTRACT_WORK", "SPOT_WORK"],
    });
  });

  it("takes no FAX and no URL", () => {
    expect(createClientSchema.parse({ ...CLIENT, fax: null, webUrl: null })).toMatchObject({
      fax: null,
      webUrl: null,
    });
  });

  it("names each missing choice with the legacy message", () => {
    const missing = (key: string, value: unknown) =>
      firstIssue(createClientSchema.safeParse({ ...CLIENT, [key]: value }));

    expect(missing("areas", [])).toEqual({ path: "areas", message: "エリアを選択してください" });
    expect(missing("regionCodes", [])).toEqual({
      path: "regionCodes",
      message: "地域を選択してください",
    });
    expect(missing("chargerUserIds", [])).toEqual({
      path: "chargerUserIds",
      message: "担当者を選択してください",
    });
    expect(missing("orderTypes", [])).toEqual({
      path: "orderTypes",
      message: "受注種別を選択してください",
    });
    expect(missing("name", " ")).toEqual({
      path: "name",
      message: "クライアント名を入力してください",
    });
    expect(missing("nameKana", "かな")).toEqual({
      path: "nameKana",
      message: "全角カタカナで入力してください",
    });
    expect(missing("number", 0)).toEqual({
      path: "number",
      message: "クライアント番号は正の整数で入力してください",
    });
  });

  it("bounds the 担当者 list", () => {
    const tooMany = Array.from({ length: CHARGERS_MAX + 1 }, () => CHARGER);
    expect(createClientSchema.safeParse({ ...CLIENT, chargerUserIds: tooMany }).success).toBe(
      false,
    );
  });
});

describe("urlSchema (legacy UrlSchema)", () => {
  it("takes an address with or without its scheme, as typed", () => {
    for (const url of ["example.com", "https://example.com", "http://www.example.co.jp/path"]) {
      expect(urlSchema.parse(url)).toBe(url);
    }
  });

  it("refuses a host without a domain and anything that is not a web address", () => {
    for (const url of ["localhost", "example.c", "exa mple.com", "javascript:alert(1)", ""]) {
      expect(firstIssue(urlSchema.safeParse(url))?.message).toBe(
        "有効なURLを入力してください（例: example.com または https://example.com）",
      );
    }
  });
});

describe("clientFormSchema and updateClientSchema", () => {
  it("asks the form for the looked-up 住所(県名) and the edit for the client id", () => {
    expect(
      firstIssue(
        clientFormSchema.safeParse({
          ...CLIENT,
          address: { ...CLIENT.address, pref: "", cityTown: "" },
        }),
      ),
    ).toEqual({ path: "address.pref", message: "郵便番号を入力してください" });
    expect(updateClientSchema.safeParse(CLIENT).success).toBe(false);
  });
});

describe("listClientsSchema", () => {
  it("lists by クライアント番号 ascending with every status but 停止 left to the service", () => {
    expect(listClientsSchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      sortBy: "number",
      sortOrder: "asc",
    });
  });

  it("reads the filters as the URL carries them", () => {
    expect(
      listClientsSchema.parse({
        statuses: ["SUSPENDED"],
        areas: ["EAST"],
        regionCodes: ["4"],
        orderTypes: ["DISPATCH"],
        sortBy: "name",
      }),
    ).toMatchObject({
      statuses: ["SUSPENDED"],
      areas: ["EAST"],
      regionCodes: [4],
      orderTypes: ["DISPATCH"],
      sortBy: "name",
    });
  });
});

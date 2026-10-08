import { describe, expect, it } from "vitest";

import {
  addressByPostCodeSchema,
  addressFormSchema,
  postCodeSchema,
  regionCodeSchema,
  sourceAreaSchema,
} from "../src/source.schema";

describe("postCodeSchema", () => {
  it.each(["123-4567", "1234567", " 123-4567 "])("reads %j as seven digits", (value) => {
    expect(postCodeSchema.parse(value)).toBe("1234567");
  });

  it.each(["12-34567", "1234-567", "123456", "12345678", "abc-defg", ""])(
    "refuses %j with the legacy message",
    (value) => {
      const result = postCodeSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("正しい郵便番号を入力してください");
    },
  );

  it("is the input of the address lookup", () => {
    expect(addressByPostCodeSchema.parse({ postCode: "060-0001" })).toEqual({
      postCode: "0600001",
    });
  });
});

describe("regionCodeSchema", () => {
  it("reads a code from a URL or select value", () => {
    expect(regionCodeSchema.parse("4")).toBe(4);
    expect(regionCodeSchema.parse(7)).toBe(7);
  });

  it.each(["0", "-1", "1.5", "x", ""])("refuses %j", (value) => {
    expect(regionCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe("sourceAreaSchema", () => {
  it("accepts the two legacy areas only", () => {
    expect(sourceAreaSchema.parse("EAST")).toBe("EAST");
    expect(sourceAreaSchema.safeParse("NORTH").success).toBe(false);
  });
});

describe("addressFormSchema", () => {
  it("keeps the lookup's 県名 and 市町村名 beside the API's post code and line", () => {
    expect(
      addressFormSchema.parse({
        postCode: "160-0022",
        address1: "1-2-3",
        pref: "東京都",
        cityTown: "新宿区新宿",
      }),
    ).toEqual({ postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" });
  });

  it("refuses an address whose post code was not found: no 県名", () => {
    const result = addressFormSchema.safeParse({
      postCode: "0000000",
      address1: "1-2-3",
      pref: "",
      cityTown: "",
    });

    expect(result.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["pref", "郵便番号を入力してください"],
    ]);
  });
});

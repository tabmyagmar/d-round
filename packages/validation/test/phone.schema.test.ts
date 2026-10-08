import { describe, expect, it } from "vitest";

import { toHalfWidthDigits } from "../src/common.schema";
import { faxSchema, formatPhoneNumber, phoneSchema } from "../src/phone.schema";

describe("phoneSchema", () => {
  it.each([
    ["090-1234-5678", "090-1234-5678"],
    ["09012345678", "090-1234-5678"],
    ["０９０ー１２３４ー５６７８", "090-1234-5678"],
    ["0312345678", "03-1234-5678"],
    ["0466-12-3456", "0466-12-3456"],
    ["+81 90 1234 5678", "090-1234-5678"],
  ])("takes %j and stores the national format %j", (value, stored) => {
    expect(phoneSchema.parse(value)).toBe(stored);
  });

  it.each(["", "1234567890", "090-1234", "0901234567", "090-1234-56789", "03-1234-567"])(
    "refuses %j, which is no number in Japan, with the legacy message",
    (value) => {
      expect(phoneSchema.safeParse(value).error?.issues[0]?.message).toBe(
        "電話番号を入力してください",
      );
    },
  );
});

describe("faxSchema", () => {
  it("takes a fixed-line number and stores its national format", () => {
    expect(faxSchema.parse("0312345678")).toBe("03-1234-5678");
    expect(faxSchema.parse("06-1234-5678")).toBe("06-1234-5678");
  });

  it.each(["090-1234-5678", "050-1234-5678", "03-1234-567", ""])(
    "refuses %j, as the legacy FAX rule did",
    (value) => {
      expect(faxSchema.safeParse(value).error?.issues[0]?.message).toBe(
        "正しいFAX番号を入力してください",
      );
    },
  );
});

describe("formatPhoneNumber", () => {
  it.each([
    ["03", "03"],
    ["0312", "03-12"],
    ["0312345678", "03-1234-5678"],
    ["０９０１２３４", "090-1234"],
    ["090-1234-5678", "090-1234-5678"],
    ["090a1234", "090-1234"],
  ])("formats %j as typed: %j", (typed, shown) => {
    expect(formatPhoneNumber(typed)).toBe(shown);
  });
});

describe("toHalfWidthDigits", () => {
  it("turns full-width digits and dashes into half-width ones", () => {
    expect(toHalfWidthDigits("０３ー１２３４－５６７８")).toBe("03-1234-5678");
  });
});

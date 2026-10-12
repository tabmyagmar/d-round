import { describe, expect, it } from "vitest";
import { z } from "zod";

import { requiredText } from "../../src/common.schema";
import {
  checkCsvLines,
  dateCell,
  defineCsvType,
  integerCell,
  labelCell,
  labelListCell,
  nameListCell,
  optionalIntegerCell,
  textCell,
} from "../../src/csv";
import type { CsvLookups, ParsedCsvLine } from "../../src/csv";
import { emailSchema, employeeNumberSchema, kanaSchema } from "../../src/user.schema";

const lookups: CsvLookups = {
  regionCodeByName: new Map([
    ["北海道", 1],
    ["東北", 2],
  ]),
  prefectureCodeByName: new Map(),
};

const sample = defineCsvType({
  type: "USER_CREATE",
  columns: [
    { key: "employeeNumber", header: "社員番号" },
    { key: "lastName", header: "姓（必須）", required: true },
    { key: "lastNameKana", header: "セイ（必須）", required: true },
    { key: "email", header: "メールアドレス（必須）", required: true },
    { key: "role", header: "アカウントタイプ（必須）", required: true },
    { key: "areas", header: "エリア（必須）", required: true },
    { key: "regionCodes", header: "地区（必須）", required: true },
    { key: "retirementDate", header: "退職日" },
    { key: "count", header: "人数" },
  ],
  uniqueKeys: ["email", "employeeNumber"],
  rowSchema: (codes) =>
    z.object({
      employeeNumber: optionalIntegerCell("社員番号", employeeNumberSchema("社員番号")),
      lastName: textCell(requiredText("姓", 80)),
      lastNameKana: textCell(kanaSchema("セイ")),
      email: textCell(emailSchema),
      role: labelCell({ アドミン: "admin", AM: "am" }, "アカウントタイプを選択してください"),
      areas: labelListCell({ 東日本: "EAST", 西日本: "WEST" }, "エリアを選択してください"),
      regionCodes: nameListCell(codes.regionCodeByName, "地域を選択してください"),
      retirementDate: dateCell(),
      count: integerCell("人数", z.number().optional()),
    }),
});

const cells = {
  employeeNumber: "１２",
  lastName: "佐藤",
  lastNameKana: "サトウ",
  email: "Sato@Example.jp",
  role: "AM",
  areas: "東日本、西日本",
  regionCodes: "北海道,東北",
  retirementDate: "2026/1/5",
  count: "",
};

const line = (lineNumber: number, overrides: Record<string, string> = {}): ParsedCsvLine => ({
  lineNumber,
  cells: { ...cells, ...overrides },
});

describe("checkCsvLines", () => {
  it("turns a valid row into the form's values: numbers, codes and ISO dates", () => {
    const [checked] = checkCsvLines(sample, [line(2)], lookups);

    expect(checked).toMatchObject({ lineNumber: 2, errors: [] });
    expect(checked?.row).toEqual({
      employeeNumber: 12,
      lastName: "佐藤",
      lastNameKana: "サトウ",
      email: "Sato@Example.jp",
      role: "am",
      areas: ["EAST", "WEST"],
      regionCodes: [1, 2],
      retirementDate: "2026-01-05",
    });
  });

  it("reports each column's problem with the form's message, naming the column when it does not", () => {
    const [checked] = checkCsvLines(
      sample,
      [
        line(3, {
          employeeNumber: "A12",
          lastName: "",
          lastNameKana: "さとう",
          email: "sato",
          role: "社長",
          areas: "北日本",
          regionCodes: "北海道,北海道,沖縄",
          retirementDate: "2026/2/30",
          count: "3人",
        }),
      ],
      lookups,
    );

    expect(checked?.row).toBeNull();
    expect(checked?.errors).toEqual([
      "社員番号は半角数字で入力してください",
      "姓を入力してください",
      "セイ: 全角カタカナで入力してください",
      "メールアドレスの形式が正しくありません",
      "アカウントタイプ: 「社長」は使えません（アドミン、AM）",
      "エリア: 「北日本」は使えません（東日本、西日本）",
      "地区: 「北海道」が重複しています",
      "地区: 「沖縄」は使えません（北海道、東北）",
      "退職日: 日付は YYYY/MM/DD の形式で入力してください",
      "人数は半角数字で入力してください",
    ]);
  });

  it("says a required list is empty and leaves an empty optional cell null", () => {
    const [checked] = checkCsvLines(
      sample,
      [line(2, { employeeNumber: "", regionCodes: "", retirementDate: "" })],
      lookups,
    );

    expect(checked?.errors).toEqual(["地区: 地域を選択してください"]);
  });

  it("flags each repeat of a unique value within the file, ignoring case and empty cells", () => {
    const checked = checkCsvLines(
      sample,
      [
        line(2),
        line(3, { email: "sato@example.JP", employeeNumber: "" }),
        line(4, { email: "other@example.jp", employeeNumber: "" }),
        line(5, { email: "third@example.jp" }),
      ],
      lookups,
    );

    expect(checked.map((checkedLine) => checkedLine.errors)).toEqual([
      [],
      ["メールアドレス: sato@example.jp CSV内で重複しています"],
      [],
      ["社員番号: １２ CSV内で重複しています"],
    ]);
    expect(checked.map((checkedLine) => checkedLine.row === null)).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { CSV_MAX_ROWS, decodeCsv, parseCsv, toCsvText } from "../../src/csv";
import type { CsvColumn } from "../../src/csv";

const columns: CsvColumn[] = [
  { key: "employeeNumber", header: "社員番号" },
  { key: "lastName", header: "姓（必須）", required: true },
  { key: "postCode", header: "郵便番号" },
  { key: "regions", header: "地区（必須）", aliases: ["地域"], required: true },
];

const utf8 = (text: string) => new TextEncoder().encode(text);

/** `社員番号,姓（必須）,郵便番号\r\n0012,髙橋,0600000\r\n` as Excel saves it on Japanese Windows. */
const SHIFT_JIS = new Uint8Array([
  142, 208, 136, 245, 148, 212, 141, 134, 44, 144, 169, 129, 105, 149, 75, 144, 123, 129, 106, 44,
  151, 88, 149, 214, 148, 212, 141, 134, 13, 10, 48, 48, 49, 50, 44, 238, 224, 139, 180, 44, 48, 54,
  48, 48, 48, 48, 48, 13, 10,
]);

describe("decodeCsv", () => {
  it("reads UTF-8 with or without a BOM and Shift_JIS, the Windows extensions included", () => {
    expect(decodeCsv(utf8("\uFEFF姓,名\r\n"))).toBe("姓,名\r\n");
    expect(decodeCsv(utf8("姓,名\r\n"))).toBe("姓,名\r\n");
    expect(decodeCsv(SHIFT_JIS)).toBe("社員番号,姓（必須）,郵便番号\r\n0012,髙橋,0600000\r\n");
  });
});

describe("parseCsv", () => {
  it("keys the cells by column, keeps every cell a string and numbers rows as Excel does", () => {
    const parsed = parseCsv(
      [
        "社員番号, 姓（必須） ,郵便番号,地域,備考",
        '0012,髙橋,0600000,"北海道,東北",無視される列',
        ",,,,",
        '7," 佐藤 ",,"南関東",""',
        '8,"山田\r\n太郎",,関西,',
        "",
      ].join("\r\n"),
      columns,
    );

    expect(parsed.fileError).toBeNull();
    expect(parsed.lines).toEqual([
      {
        lineNumber: 2,
        cells: {
          employeeNumber: "0012",
          lastName: "髙橋",
          postCode: "0600000",
          regions: "北海道,東北",
        },
      },
      {
        lineNumber: 4,
        cells: { employeeNumber: "7", lastName: "佐藤", postCode: "", regions: "南関東" },
      },
      {
        lineNumber: 5,
        cells: { employeeNumber: "8", lastName: "山田\r\n太郎", postCode: "", regions: "関西" },
      },
    ]);
  });

  it("names the required columns a file lacks", () => {
    expect(parseCsv("社員番号,郵便番号\r\n1,0600000\r\n", columns)).toEqual({
      lines: [],
      fileError: "必要な列がありません: 姓（必須）、地区（必須）",
    });
  });

  it("refuses an empty file, a file without data and a broken quote", () => {
    expect(parseCsv("", columns).fileError).toBe("CSVに見出しの行がありません");
    expect(parseCsv("姓（必須）,地域\r\n,\r\n", columns).fileError).toBe(
      "CSVにデータの行がありません",
    );
    expect(parseCsv('姓（必須）,地域\r\n"佐藤,関西\r\n', columns).fileError).toMatch(
      /^CSVの形式が正しくありません/,
    );
  });

  it(`takes ${String(CSV_MAX_ROWS)} rows and refuses one more`, () => {
    const file = (rows: number) =>
      [
        "姓（必須）,地域",
        ...Array.from({ length: rows }, (_, index) => `姓${String(index)},関西`),
      ].join("\n");

    expect(parseCsv(file(CSV_MAX_ROWS), columns).lines).toHaveLength(CSV_MAX_ROWS);
    expect(parseCsv(file(CSV_MAX_ROWS + 1), columns).fileError).toBe(
      "一度に取り込めるのは150件までです（151件）。ファイルを分けてください",
    );
  });
});

describe("toCsvText", () => {
  it("writes what Excel opens: a BOM, CRLF and every field quoted", () => {
    const text = toCsvText([
      ["行番号", "エラー内容"],
      ["2", '姓: "必須"\n名: 必須'],
    ]);

    expect(text).toBe('\uFEFF"行番号","エラー内容"\r\n"2","姓: ""必須""\n名: 必須"\r\n');
    expect(
      parseCsv(text, [
        { key: "line", header: "行番号" },
        { key: "errors", header: "エラー内容" },
      ]).lines,
    ).toEqual([{ lineNumber: 2, cells: { line: "2", errors: '姓: "必須"\n名: 必須' } }]);
  });
});

import { describe, expect, it } from "vitest";

import { userCreateCsv } from "@repo/validation/csv";

import { checkCsvFile } from "@/features/csv/utils/csv-file-check";

import { LOOKUPS, shiftJis, userCsvText, userLine } from "../fixtures";

const utf8 = (text: string) => new TextEncoder().encode(`\u{FEFF}${text}`);

describe("checkCsvFile", () => {
  it("reads a Shift_JIS file from Excel and lists the lines it refuses, by CSV row", () => {
    const bytes = shiftJis(userCsvText(userLine(1001), userLine(1002, "やまだ")));

    expect(checkCsvFile(bytes, userCreateCsv, LOOKUPS)).toEqual({
      fileError: null,
      lineErrors: [{ lineNumber: 3, errors: ["セイ: 全角カタカナで入力してください"] }],
    });
  });

  it("passes a clean UTF-8 file with a BOM", () => {
    expect(checkCsvFile(utf8(userCsvText(userLine(1001))), userCreateCsv, LOOKUPS)).toEqual({
      fileError: null,
      lineErrors: [],
    });
  });

  it("refuses a file of more than 150 rows as a whole", () => {
    const lines = Array.from({ length: 151 }, (_, index) => userLine(2000 + index));

    const found = checkCsvFile(utf8(userCsvText(...lines)), userCreateCsv, LOOKUPS);

    expect(found.fileError).toMatch(/150件までです（151件）/u);
    expect(found.lineErrors).toEqual([]);
  });
});

import type { CsvImport, CsvImportRow } from "@/features/csv/types";
import { csvLookupsOf } from "@/features/csv/utils/csv-file-check";

/** 担当者 CSV files and imports for the CSV tests (the template's header, rows that pass). */

export const USER_HEADER =
  "社員番号（必須）,姓（必須）,名（必須）,セイ（必須）,メイ（必須）,エリア（必須）,地区（必須）,部署名（必須）,役職（必須）,メールアドレス（必須）,アカウントタイプ（必須）,退職日";

/** A 担当者 line that passes the format check; `kana` replaces its セイ. */
export const userLine = (employeeNumber: number, kana = "ヤマダ") =>
  `${String(employeeNumber)},山田,太郎,${kana},タロウ,東日本,南関東,人事部,正社員,user${String(employeeNumber)}@example.com,AM,`;

export const userCsvText = (...lines: string[]) => [USER_HEADER, ...lines].join("\r\n");

export const LOOKUPS = csvLookupsOf({
  regions: [{ code: 4, name: "南関東" }],
  prefectures: [{ code: 13, name: "東京都" }],
});

/**
 * Shift_JIS bytes of a text, as Excel on Japanese Windows writes them, through the decoder's own
 * table: Node decodes Shift_JIS but has no encoder.
 */
const SHIFT_JIS = (() => {
  const decoder = new TextDecoder("shift_jis");
  const replacement = String.fromCodePoint(0xfffd);
  const bytesOf = new Map<string, number[]>();
  for (let lead = 0x81; lead <= 0xfc; lead += 1) {
    if (lead > 0x9f && lead < 0xe0) {
      continue;
    }
    for (let trail = 0x40; trail <= 0xfc; trail += 1) {
      const char = decoder.decode(new Uint8Array([lead, trail]));
      if (char.length === 1 && char !== replacement && !bytesOf.has(char)) {
        bytesOf.set(char, [lead, trail]);
      }
    }
  }
  return bytesOf;
})();

export const shiftJis = (text: string): Uint8Array => {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const pair = code < 0x80 ? [code] : SHIFT_JIS.get(char);
    if (!pair) {
      throw new Error(`${char} has no Shift_JIS bytes`);
    }
    bytes.push(...pair);
  }
  return new Uint8Array(bytes);
};

const NOW = new Date("2026-10-12T03:00:00.000Z");

/** An import as `csvImport.byId` returns it. */
export const csvImportOf = (overrides: Partial<CsvImport> = {}): CsvImport => ({
  id: "019a0000-0000-7000-8000-000000000001",
  type: "USER_CREATE",
  status: "CHECKED",
  fileName: "担当者.csv",
  createdById: "019a0000-0000-7000-8000-0000000000aa",
  totalCount: 2,
  validCount: 1,
  selectedCount: 0,
  processedCount: 0,
  importedCount: 0,
  failedCount: 0,
  fileError: null,
  lastError: null,
  checkedAt: NOW,
  confirmedAt: null,
  importedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

/** A line of `csvImport.rows`: the cells of `userLine` as the check stored them. */
export const csvRowOf = (
  lineNumber: number,
  overrides: Partial<CsvImportRow> = {},
): CsvImportRow => ({
  id: `019a0000-0000-7000-8000-${String(lineNumber).padStart(12, "0")}`,
  csvImportId: "019a0000-0000-7000-8000-000000000001",
  lineNumber,
  data: {
    employeeNumber: String(1000 + lineNumber),
    lastName: "山田",
    firstName: `太郎${String(lineNumber)}`,
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
    areas: "東日本",
    regionCodes: "南関東",
    departmentName: "人事部",
    position: "正社員",
    email: `user${String(lineNumber)}@example.com`,
    role: "AM",
  },
  errors: [],
  selected: false,
  result: null,
  resultError: null,
  entityId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

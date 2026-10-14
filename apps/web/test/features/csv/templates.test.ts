import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CSV_IMPORT_TYPES } from "@repo/validation";
import { checkCsvLines, decodeCsv, parseCsv } from "@repo/validation/csv";

import { csvLookupsOf } from "@/features/csv/utils/csv-file-check";
import { CSV_TYPE_CONTENT } from "@/features/csv/utils/csv-type-content";

const PUBLIC = fileURLToPath(new URL("../../../public", import.meta.url));

/** The seeded names the templates' sample rows use. */
const LOOKUPS = csvLookupsOf({
  regions: [
    { code: 1, name: "北海道" },
    { code: 2, name: "東北" },
    { code: 7, name: "関西" },
  ],
  prefectures: [{ code: 2, name: "青森県" }],
});

describe("CSV templates (CSVデータフォーマット)", () => {
  it.each(CSV_IMPORT_TYPES)("%s: its type's headers, and sample rows the check passes", (type) => {
    const { definition, templatePath } = CSV_TYPE_CONTENT[type];
    const text = decodeCsv(readFileSync(`${PUBLIC}${templatePath}`));

    expect(text.split("\r\n")[0]).toBe(definition.columns.map((column) => column.header).join(","));
    const parsed = parseCsv(text, definition.columns);
    expect(parsed.fileError).toBeNull();
    expect(parsed.lines.length).toBeGreaterThan(0);
    expect(checkCsvLines(definition, parsed.lines, LOOKUPS).flatMap((line) => line.errors)).toEqual(
      [],
    );
  });
});

import { describe, expect, it } from "vitest";

import { CSV_IMPORT_TYPES } from "@repo/validation";

import { CSV_TYPE_CONTENT, summaryLineOf } from "@/features/csv/utils/csv-type-content";

describe("CSV_TYPE_CONTENT", () => {
  it("names only columns its type has in the summary cells", () => {
    for (const type of CSV_IMPORT_TYPES) {
      const { definition, summary } = CSV_TYPE_CONTENT[type];
      const keys = new Set(definition.columns.map((column) => column.key));
      const unknown = summary
        .flatMap((column) => column.lines.flat())
        .filter((key) => !keys.has(key));
      expect({ type, unknown }).toEqual({ type, unknown: [] });
    }
  });

  it("joins a summary line's cells with a space and leaves out the empty ones", () => {
    const data = { lastName: "山田", firstName: "太郎", email: "" };

    expect(summaryLineOf(data, ["lastName", "firstName"])).toBe("山田 太郎");
    expect(summaryLineOf(data, ["email", "lastName"])).toBe("山田");
    expect(summaryLineOf(null, ["lastName"])).toBe("");
  });
});

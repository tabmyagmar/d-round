import { describe, expect, it } from "vitest";

import { CSV_EXPORT_TYPES, createCsvExportSchema } from "@repo/validation";

import { CSV_EXPORT_CONTENT } from "@/features/csv/utils/csv-export-content";

const IDS = ["019a0000-0000-7000-8000-000000000001"];

describe("CSV_EXPORT_CONTENT", () => {
  it("opens every type with its main sheet's columns ticked, an input the API takes", () => {
    for (const type of CSV_EXPORT_TYPES) {
      const content = CSV_EXPORT_CONTENT[type];
      const input = createCsvExportSchema.parse(content.inputOf(IDS, content.initial));

      expect(input.type).toBe(type);
      expect(input.fields.length).toBe(content.groups[0]?.options.length);
    }
  });

  it("sends the ticked columns of each group, so the same key in two groups stays apart", () => {
    const input = CSV_EXPORT_CONTENT.CLIENT.inputOf(IDS, [
      "fields:number",
      "branchFields:name",
      "branchFields:number",
    ]);

    expect(input).toEqual({
      type: "CLIENT",
      ids: IDS,
      fields: ["number"],
      branchFields: ["number", "name"],
    });
  });

  it("adds the 続柄 ticked for a staff download's 家族情報", () => {
    const input = CSV_EXPORT_CONTENT.STAFF.inputOf(IDS, [
      "fields:employeeNumber",
      "familyRelations:WIFE",
    ]);

    expect(input).toMatchObject({ fields: ["employeeNumber"], familyRelations: ["WIFE"] });
    expect(CSV_EXPORT_CONTENT.STAFF.groups[1]?.options[1]).toEqual({
      value: "familyRelations:WIFE",
      label: "妻",
    });
  });
});

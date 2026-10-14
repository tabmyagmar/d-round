import { describe, expect, it } from "vitest";

import {
  CSV_EXPORT_MAX_ROWS,
  CSV_EXPORT_NO_FIELDS,
  CSV_EXPORT_TOO_MANY,
  createCsvExportSchema,
} from "../src/csv-export.schema";

const id = () => crypto.randomUUID();

const messagesOf = (input: unknown): string[] => {
  const result = createCsvExportSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("createCsvExportSchema", () => {
  it("keeps the picked columns once each, in the file's order", () => {
    const ids = [id()];

    expect(
      createCsvExportSchema.parse({
        type: "STAFF",
        ids,
        fields: ["status", "employeeNumber", "status"],
      }),
    ).toEqual({ type: "STAFF", ids, fields: ["employeeNumber", "status"], familyRelations: [] });
    expect(
      createCsvExportSchema.parse({
        type: "CLIENT",
        ids,
        fields: ["name"],
        branchFields: ["contactEmail", "number"],
      }),
    ).toMatchObject({ branchFields: ["number", "contactEmail"] });
    expect(createCsvExportSchema.parse({ type: "CLIENT", ids, fields: ["name"] })).toMatchObject({
      branchFields: [],
    });
  });

  it("needs a row and a column, and refuses more rows than the legacy limit", () => {
    expect(messagesOf({ type: "USER", ids: [], fields: ["email"] })).toEqual([
      "ダウンロードする担当者を選択してください",
    ]);
    expect(messagesOf({ type: "BRANCH", ids: [id()], fields: [] })).toEqual([CSV_EXPORT_NO_FIELDS]);
    const tooMany = Array.from({ length: CSV_EXPORT_MAX_ROWS + 1 }, id);
    expect(messagesOf({ type: "USER", ids: tooMany, fields: ["email"] })).toEqual([
      CSV_EXPORT_TOO_MANY,
    ]);
  });

  it("refuses a column the type does not have: the browser names keys, never paths", () => {
    expect(messagesOf({ type: "USER", ids: [id()], fields: ["branchName"] })).toHaveLength(1);
    expect(
      messagesOf({ type: "USER", ids: [id()], fields: ["profile.employeeNumber"] }),
    ).toHaveLength(1);
    expect(
      messagesOf({ type: "STAFF", ids: [id()], fields: ["email"], familyRelations: ["COUSIN"] }),
    ).toHaveLength(1);
  });
});

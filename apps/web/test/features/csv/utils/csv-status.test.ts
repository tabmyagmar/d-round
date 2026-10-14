import { describe, expect, it } from "vitest";

import {
  csvImportActionOf,
  csvImportStatusOf,
  csvImportStepOf,
  isCsvImportWorking,
} from "@/features/csv/utils/csv-status";

import { csvImportOf } from "../fixtures";

describe("csv import status", () => {
  it("puts an import at its step: 内容確認 until confirmed, 登録 while importing, then 結果", () => {
    expect(
      (
        ["UPLOADED", "CHECKING", "CHECKED", "CONFIRMED", "IMPORTING", "IMPORTED", "FAILED"] as const
      ).map(csvImportStepOf),
    ).toEqual([1, 1, 1, 2, 2, 3, 3]);
    expect(
      (["UPLOADED", "CHECKING", "CONFIRMED", "IMPORTING"] as const).every(isCsvImportWorking),
    ).toBe(true);
    expect(isCsvImportWorking("CHECKED")).toBe(false);
  });

  it("labels it as the legacy 履歴 did, telling errors from a clean result", () => {
    const labelOf = (overrides: Parameters<typeof csvImportOf>[0]) =>
      csvImportStatusOf(csvImportOf(overrides)).label;

    expect(labelOf({ status: "CHECKING" })).toBe("確認中");
    expect(labelOf({ status: "CHECKED", totalCount: 2, validCount: 1 })).toBe("確認エラー");
    expect(labelOf({ status: "CHECKED", totalCount: 2, validCount: 2 })).toBe("確認完了");
    expect(labelOf({ status: "CHECKED", totalCount: 0, validCount: 0, fileError: "列" })).toBe(
      "確認エラー",
    );
    expect(labelOf({ status: "IMPORTING" })).toBe("登録中");
    expect(labelOf({ status: "IMPORTED", failedCount: 1 })).toBe("登録エラー");
    expect(labelOf({ status: "IMPORTED", failedCount: 0 })).toBe("登録済み");
    expect(labelOf({ status: "FAILED" })).toBe("システムエラー");
  });

  it("offers 登録 for a checked import and 確認 for a finished one, nothing while working", () => {
    expect(csvImportActionOf("CHECKED")).toBe("登録");
    expect(csvImportActionOf("IMPORTED")).toBe("確認");
    expect(csvImportActionOf("FAILED")).toBe("確認");
    expect(csvImportActionOf("IMPORTING")).toBeNull();
  });
});

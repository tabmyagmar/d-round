// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvResultStep } from "@/features/csv/components/import/csv-result-step";
import type { CsvImport } from "@/features/csv/types";
import { CSV_TYPE_CONTENT } from "@/features/csv/utils/csv-type-content";

import { csvImportOf, csvRowOf } from "../../fixtures";

afterEach(cleanup);

const renderStep = (csvImport: CsvImport) => {
  render(
    <CsvResultStep
      csvImport={csvImport}
      rows={[
        csvRowOf(2, { selected: true, result: "IMPORTED" }),
        csvRowOf(3, {
          selected: true,
          result: "FAILED",
          resultError: "既に登録されているため、登録できませんでした",
        }),
        csvRowOf(4, { errors: ["セイ: 全角カタカナで入力してください"] }),
      ]}
      summary={CSV_TYPE_CONTENT.USER_CREATE.summary}
      downloading={false}
      onDownloadErrors={vi.fn()}
      onClose={vi.fn()}
    />,
  );
};

describe("CsvResultStep", () => {
  it("shows the counts and each confirmed line's result, with the error CSV", () => {
    renderStep(
      csvImportOf({
        status: "IMPORTED",
        totalCount: 3,
        validCount: 2,
        selectedCount: 2,
        processedCount: 2,
        importedCount: 1,
        failedCount: 1,
      }),
    );

    expect(screen.getByText(/登録: 1 件/u)).toBeDefined();
    expect(screen.getByText("送信完了")).toBeDefined();
    expect(screen.getByText("送信エラー")).toBeDefined();
    expect(screen.getByText("既に登録されているため、登録できませんでした")).toBeDefined();
    // The line the check refused was not confirmed: the error CSV lists it, the table does not.
    expect(screen.queryByText("セイ: 全角カタカナで入力してください")).toBeNull();
    expect(screen.getByRole("button", { name: "エラーCSV" })).toBeDefined();
  });

  it("says why an import stopped and counts the lines it never reached", () => {
    renderStep(
      csvImportOf({
        status: "FAILED",
        totalCount: 3,
        validCount: 3,
        selectedCount: 3,
        processedCount: 2,
        importedCount: 1,
        failedCount: 1,
        lastError: "登録中に問題が発生しました",
      }),
    );

    expect(screen.getByText("登録中に問題が発生しました")).toBeDefined();
    expect(screen.getByText(/未登録: 1 件/u)).toBeDefined();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvCheckStep } from "@/features/csv/components/import/csv-check-step";
import type { CsvImport, CsvImportRow } from "@/features/csv/types";
import { CSV_TYPE_CONTENT } from "@/features/csv/utils/csv-type-content";

import { csvImportOf, csvRowOf } from "../../fixtures";

afterEach(cleanup);

const ROWS = [
  csvRowOf(2),
  csvRowOf(3, { errors: ["セイ: 全角カタカナで入力してください"] }),
  csvRowOf(4),
];

const renderStep = (csvImport: CsvImport, rows: CsvImportRow[] | undefined = ROWS) => {
  const onConfirm = vi.fn();
  const onDownloadErrors = vi.fn();
  render(
    <StrictMode>
      <CsvCheckStep
        csvImport={csvImport}
        rows={rows}
        summary={CSV_TYPE_CONTENT.USER_CREATE.summary}
        pending={false}
        downloading={false}
        onConfirm={onConfirm}
        onDownloadErrors={onDownloadErrors}
        onClose={vi.fn()}
      />
    </StrictMode>,
  );
  return { onConfirm, onDownloadErrors };
};

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("CsvCheckStep", () => {
  it("waits while the worker checks the file", () => {
    renderStep(csvImportOf({ status: "CHECKING" }), undefined);

    expect(screen.getByRole("status").textContent).toMatch(/ファイルの内容を確認しています/u);
    expect(screen.queryByRole("button", { name: "確定" })).toBeNull();
  });

  it("ticks the importable lines, leaves a line with errors unselectable, and confirms the ticked", () => {
    const { onConfirm } = renderStep(csvImportOf({ totalCount: 3, validCount: 2 }));

    expect(box("2行目を選択").getAttribute("aria-checked")).toBe("true");
    expect(box("3行目を選択").hasAttribute("data-disabled")).toBe(true);
    expect(screen.getByText("セイ: 全角カタカナで入力してください")).toBeDefined();
    expect(screen.getByText("取込不可")).toBeDefined();

    fireEvent.click(box("4行目を選択"));
    fireEvent.click(screen.getByRole("button", { name: "確定" }));

    expect(onConfirm).toHaveBeenCalledWith([2]);
  });

  it("selects only the importable lines from the header", () => {
    const { onConfirm } = renderStep(csvImportOf({ totalCount: 3, validCount: 2 }));

    fireEvent.click(box("取込可能な行をすべて選択"));
    expect(screen.getByRole("button", { name: "確定" })).toHaveProperty("disabled", true);
    fireEvent.click(box("取込可能な行をすべて選択"));
    fireEvent.click(screen.getByRole("button", { name: "確定" }));

    expect(onConfirm).toHaveBeenCalledWith([2, 4]);
  });

  it("offers the error CSV when lines were refused", () => {
    const { onDownloadErrors } = renderStep(csvImportOf({ totalCount: 3, validCount: 2 }));

    fireEvent.click(screen.getByRole("button", { name: "エラーCSV" }));

    expect(onDownloadErrors).toHaveBeenCalledTimes(1);
  });

  it("says why a file cannot be imported at all", () => {
    renderStep(
      csvImportOf({ totalCount: 0, validCount: 0, fileError: "必要な列がありません: 姓（必須）" }),
      [],
    );

    expect(screen.getByText("必要な列がありません: 姓（必須）")).toBeDefined();
    expect(screen.queryByRole("button", { name: "確定" })).toBeNull();
  });
});

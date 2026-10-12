// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvFileStep } from "@/features/csv/components/import/csv-file-step";
import type { CsvFileCheck } from "@/features/csv/utils/csv-file-check";

afterEach(cleanup);

const renderStep = (found: CsvFileCheck) => {
  const check = vi.fn<(file: File) => Promise<CsvFileCheck>>().mockResolvedValue(found);
  const upload = vi.fn<(file: File) => Promise<{ id: string }>>().mockResolvedValue({
    id: "019a0000-0000-7000-8000-0000000000f1",
  });
  const onSubmit = vi.fn();
  render(
    <StrictMode>
      <CsvFileStep
        check={check}
        upload={upload}
        templatePath="/csv/template/USER/CSV 担当者情報追加.csv"
        manualPath="/csv/manual/user.pdf"
        pending={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    </StrictMode>,
  );
  return { check, upload, onSubmit };
};

const pick = () => {
  fireEvent.change(screen.getByLabelText("CSVファイル"), {
    target: { files: [new File(["社員番号"], "担当者.csv", { type: "text/csv" })] },
  });
};

const submitButton = () => screen.getByRole("button", { name: "アップロード" });

describe("CsvFileStep", () => {
  it("lists the lines of a picked file that have errors and does not upload it", async () => {
    const { upload } = renderStep({
      fileError: null,
      lineErrors: [{ lineNumber: 3, errors: ["セイ: 全角カタカナで入力してください"] }],
    });

    pick();

    expect(await screen.findByText("セイ: 全角カタカナで入力してください")).toBeDefined();
    expect(screen.getByText("行: 3")).toBeDefined();
    expect(screen.getByText("担当者.csv: CSVエラーが 1 件あります")).toBeDefined();
    expect(upload).not.toHaveBeenCalled();
    expect(submitButton()).toHaveProperty("disabled", true);
  });

  it("refuses a file faulted as a whole, such as one of more than 150 rows", async () => {
    const { upload } = renderStep({
      fileError: "一度に取り込めるのは150件までです（151件）。ファイルを分けてください",
      lineErrors: [],
    });

    pick();

    expect(
      await screen.findByText(/^担当者\.csv: 一度に取り込めるのは150件までです/u),
    ).toBeDefined();
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads a clean file at once and starts the import with it", async () => {
    const { upload, onSubmit } = renderStep({ fileError: null, lineErrors: [] });

    pick();
    await waitFor(() => {
      expect(submitButton()).toHaveProperty("disabled", false);
    });
    fireEvent.click(submitButton());

    expect(upload).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("019a0000-0000-7000-8000-0000000000f1");
  });

  it("links the type's template and manual", () => {
    renderStep({ fileError: null, lineErrors: [] });

    expect(screen.getByRole("link", { name: "CSVデータフォーマット" }).getAttribute("href")).toBe(
      "/csv/template/USER/CSV 担当者情報追加.csv",
    );
    expect(screen.getByRole("link", { name: "CSVデータ説明書" }).getAttribute("href")).toBe(
      "/csv/manual/user.pdf",
    );
  });
});

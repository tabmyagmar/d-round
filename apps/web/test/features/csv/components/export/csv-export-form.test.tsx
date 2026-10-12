// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvExportForm } from "@/features/csv/components/export/csv-export-form";
import { CSV_EXPORT_CONTENT } from "@/features/csv/utils/csv-export-content";

afterEach(cleanup);

const renderForm = (selectedCount: number) => {
  const onSubmit = vi.fn();
  const content = CSV_EXPORT_CONTENT.STAFF;
  render(
    <StrictMode>
      <CsvExportForm
        label="スタッフ"
        selectedCount={selectedCount}
        groups={content.groups}
        initial={content.initial}
        pending={false}
        onSubmit={onSubmit}
        onShowHistory={vi.fn()}
      />
    </StrictMode>,
  );
  return onSubmit;
};

const downloadButton = () => screen.getByRole("button", { name: "ダウンロード" });

describe("CsvExportForm", () => {
  it("keeps ダウンロード off until a row is ticked in the list", () => {
    renderForm(0);

    expect(
      screen.getByText(/スタッフ一覧から、ダウンロードしたいスタッフを選択する/u),
    ).toBeDefined();
    expect(downloadButton()).toHaveProperty("disabled", true);
  });

  it("refuses more rows than one download takes, with the limit", () => {
    renderForm(501);

    expect(screen.getByText(/500件/u)).toBeDefined();
    expect(downloadButton()).toHaveProperty("disabled", true);
  });

  it("sends the columns ticked, every one at first, and the 続柄 chosen", () => {
    const onSubmit = renderForm(2);

    fireEvent.click(screen.getByRole("button", { name: /スタッフ情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "退職理由" }));
    fireEvent.click(screen.getByRole("button", { name: /家族情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "妻" }));
    fireEvent.click(downloadButton());

    const [values] = onSubmit.mock.lastCall as [string[]];
    expect(values).toContain("fields:employeeNumber");
    expect(values).not.toContain("fields:resignationReason");
    expect(values).toContain("familyRelations:WIFE");
  });

  it("keeps ダウンロード off once no column of the main sheet is ticked", () => {
    renderForm(2);

    fireEvent.click(screen.getByRole("button", { name: /スタッフ情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "スタッフ情報をすべて選択" }));

    expect(downloadButton()).toHaveProperty("disabled", true);
  });
});

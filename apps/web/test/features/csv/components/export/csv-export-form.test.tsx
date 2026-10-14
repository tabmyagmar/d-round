// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CSV_EXPORT_NO_FIELDS, CSV_EXPORT_TOO_MANY } from "@repo/validation";

import { CsvExportForm } from "@/features/csv/components/export/csv-export-form";
import { CSV_EXPORT_CONTENT } from "@/features/csv/utils/csv-export-content";

afterEach(cleanup);

const idsOf = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `019a0000-0000-7000-8000-${String(index).padStart(12, "0")}`,
  );

const renderForm = (ids: string[]) => {
  const onSubmit = vi.fn();
  render(
    <StrictMode>
      <CsvExportForm
        label="スタッフ"
        ids={ids}
        content={CSV_EXPORT_CONTENT.STAFF}
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
  it("keeps ダウンロード off until a row is ticked in the list, saying so as the API would", () => {
    renderForm([]);

    expect(
      screen.getByText(/スタッフ一覧から、ダウンロードしたいスタッフを選択する/u),
    ).toBeDefined();
    expect(screen.getByText("ダウンロードするスタッフを選択してください")).toBeDefined();
    expect(downloadButton()).toHaveProperty("disabled", true);
  });

  it("refuses more rows than one download takes, with the API's message", () => {
    renderForm(idsOf(501));

    expect(screen.getByText(CSV_EXPORT_TOO_MANY)).toBeDefined();
    expect(downloadButton()).toHaveProperty("disabled", true);
  });

  it("sends the columns ticked, every one at first, and the 続柄 chosen", () => {
    const ids = idsOf(2);
    const onSubmit = renderForm(ids);

    fireEvent.click(screen.getByRole("button", { name: /スタッフ情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "退職理由" }));
    fireEvent.click(screen.getByRole("button", { name: /家族情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "妻" }));
    fireEvent.click(downloadButton());

    const [input] = onSubmit.mock.lastCall as [
      { ids: string[]; fields: string[]; familyRelations: string[] },
    ];
    expect(input.ids).toEqual(ids);
    expect(input.fields).toContain("employeeNumber");
    expect(input.fields).not.toContain("resignationReason");
    expect(input.familyRelations).toEqual(["WIFE"]);
  });

  it("keeps ダウンロード off once no column of the main sheet is ticked", () => {
    renderForm(idsOf(2));

    fireEvent.click(screen.getByRole("button", { name: /スタッフ情報/u }));
    fireEvent.click(screen.getByRole("checkbox", { name: "スタッフ情報をすべて選択" }));

    expect(screen.getByText(CSV_EXPORT_NO_FIELDS)).toBeDefined();
    expect(downloadButton()).toHaveProperty("disabled", true);
  });
});

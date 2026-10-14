// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvHistoryTable } from "@/features/csv/components/history/csv-history-table";
import type { CsvImportListItem } from "@/features/csv/types";

import { csvImportOf } from "../../fixtures";

afterEach(cleanup);

/** The table's row at `index` (0 is the header). */
const rowAt = (index: number): HTMLElement => {
  const row = screen.getAllByRole("row")[index];
  if (!row) {
    throw new Error(`no row ${String(index)}`);
  }
  return row;
};

const itemOf = (id: string, overrides: Parameters<typeof csvImportOf>[0]): CsvImportListItem => ({
  ...csvImportOf({ id, ...overrides }),
  createdBy: { name: "山田 太郎", email: "yamada@example.com" },
});

describe("CsvHistoryTable", () => {
  it("shows who uploaded what, the counts, the status and the action it allows", () => {
    const onOpen = vi.fn();
    const checked = itemOf("a", { status: "CHECKED", totalCount: 3, validCount: 2 });
    render(
      <CsvHistoryTable
        title="CSVインポート担当者追加一覧"
        data={[
          checked,
          itemOf("b", { status: "IMPORTED", totalCount: 2, validCount: 2, importedCount: 2 }),
          itemOf("c", { status: "CHECKING" }),
        ]}
        isLoading={false}
        pagination={undefined}
        onOpen={onOpen}
      />,
    );

    expect(rowAt(1).textContent).toMatch(
      /山田 太郎.*取込データ入数: 3.*取込可能: 2 \/ 取込不可: 1.*確認エラー/u,
    );
    expect(rowAt(2).textContent).toMatch(/登録: 2.*登録済み/u);
    expect(rowAt(3).textContent).toMatch(/確認中/u);
    expect(within(rowAt(3)).queryByRole("button")).toBeNull();

    fireEvent.click(within(rowAt(1)).getByRole("button", { name: "登録" }));
    expect(onOpen).toHaveBeenCalledWith(checked);
    expect(within(rowAt(2)).getByRole("button", { name: "確認" })).toBeDefined();
  });
});

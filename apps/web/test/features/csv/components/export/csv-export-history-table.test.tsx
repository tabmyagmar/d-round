// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvExportHistoryTable } from "@/features/csv/components/export/csv-export-history-table";
import type { CsvExportListItem } from "@/features/csv/types";

afterEach(cleanup);

const EXPORT: CsvExportListItem = {
  id: "019a0000-0000-7000-8000-000000000e01",
  type: "STAFF",
  fileName: "StaffData_20261012.xlsx",
  rowCount: 12,
  createdById: "019a0000-0000-7000-8000-0000000000aa",
  createdAt: new Date("2026-10-12T03:00:00.000Z"),
  createdBy: { name: "山田 太郎", email: "yamada@example.com" },
};

describe("CsvExportHistoryTable", () => {
  it("lists a download with its file and count, and asks for it again on ダウンロード", () => {
    const onDownload = vi.fn();
    render(
      <CsvExportHistoryTable
        data={[EXPORT]}
        isLoading={false}
        pagination={undefined}
        downloadingId={null}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByText("StaffData_20261012.xlsx")).toBeDefined();
    expect(screen.getByText("(12)")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "ダウンロード" }));
    expect(onDownload).toHaveBeenCalledWith(EXPORT);
  });

  it("holds the button of the file being asked for", () => {
    render(
      <CsvExportHistoryTable
        data={[EXPORT]}
        isLoading={false}
        pagination={undefined}
        downloadingId={EXPORT.id}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "ダウンロード" })).toHaveProperty("disabled", true);
  });
});

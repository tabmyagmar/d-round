// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffJobHistoryTable } from "@/features/staff/components/detail/staff-job-history-table";

import { staffDetail } from "../../fixtures";

afterEach(cleanup);

describe("StaffJobHistoryTable", () => {
  it("shows the legacy columns, titled 在籍情報 with the count", () => {
    render(<StaffJobHistoryTable staff={staffDetail()} />);

    expect(screen.getByText("在籍情報").textContent).toBe("在籍情報1");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "#",
      "入社日",
      "退職日",
      "退職理由",
      "担当者",
    ]);
  });

  it("names everyone in charge during the period, the former 担当者 included", () => {
    render(<StaffJobHistoryTable staff={staffDetail()} />);

    const [, period] = screen.getAllByRole("row");
    expect(within(period!).getByText("2026/04/01")).toBeDefined();
    expect(within(period!).getByText("前任 太郎、佐藤 一郎")).toBeDefined();
  });

  it("leaves out a 担当者 whose time ended before the period began", () => {
    const staff = staffDetail();
    render(
      <StaffJobHistoryTable
        staff={{
          ...staff,
          jobHistories: [
            {
              ...staff.jobHistories[0]!,
              hireDate: new Date("2026-08-01T00:00:00Z"),
              resignationDate: new Date("2026-09-30T00:00:00Z"),
              resignationReason: "一身上の都合",
            },
          ],
        }}
      />,
    );

    const [, period] = screen.getAllByRole("row");
    expect(within(period!).getByText("佐藤 一郎")).toBeDefined();
    expect(within(period!).getByText("2026/09/30")).toBeDefined();
    expect(within(period!).getByText("一身上の都合")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffFamilyTable } from "@/features/staff/components/detail/staff-family-table";
import type { StaffDetail } from "@/features/staff/types";

afterEach(cleanup);

const member = (
  overrides: Partial<StaffDetail["familyMembers"][number]> = {},
): StaffDetail["familyMembers"][number] => ({
  id: crypto.randomUUID(),
  staffId: "staff-1",
  sortOrder: 0,
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
  relation: "HUSBAND",
  birthday: new Date("1988-05-10T00:00:00Z"),
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("StaffFamilyTable", () => {
  it("shows the legacy columns, titled 家族情報 with the count", () => {
    render(<StaffFamilyTable familyMembers={[member()]} />);

    expect(screen.getByText("家族情報").textContent).toBe("家族情報1");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "#",
      "姓",
      "名",
      "セイ",
      "メイ",
      "続柄",
      "生年月日",
    ]);
  });

  it("names the relation and writes the birthday, — for what a member does not have", () => {
    render(
      <StaffFamilyTable
        familyMembers={[
          member(),
          member({
            firstName: "花",
            lastNameKana: null,
            firstNameKana: null,
            relation: null,
            birthday: null,
          }),
        ]}
      />,
    );

    const [, full, sparse] = screen.getAllByRole("row");
    expect(within(full!).getByText("夫")).toBeDefined();
    expect(within(full!).getByText("1988/05/10")).toBeDefined();
    expect(within(sparse!).getAllByText("—")).toHaveLength(4);
  });

  it("says 家族情報はありません without members", () => {
    render(<StaffFamilyTable familyMembers={[]} />);

    expect(screen.getByText("家族情報はありません")).toBeDefined();
  });
});

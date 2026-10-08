// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { href, routes } from "@/config/routes";
import { UserStaffsCard } from "@/features/staff/components/user-staffs-card";
import type { ChargedStaff } from "@/features/staff/types";

afterEach(cleanup);

const REGION_NAMES: Record<number, string> = { 3: "北関東", 4: "南関東" };

const chargedStaff = (
  lastName: string,
  regionCodes: number[],
  employeeType: ChargedStaff["employeeType"] = "PART_TIME",
): ChargedStaff => ({
  id: crypto.randomUUID(),
  employeeNumber: 1,
  employeeType,
  lastName,
  firstName: "花子",
  regions: regionCodes.map((regionCode) => ({
    regionCode,
    region: { name: REGION_NAMES[regionCode] ?? String(regionCode) },
  })),
});

describe("UserStaffsCard", () => {
  it("counts the staff and groups them by region, in code order, each group closed", () => {
    render(
      <UserStaffsCard
        staffs={[
          chargedStaff("山田", [4]),
          chargedStaff("鈴木", [3, 4]),
          chargedStaff("田中", [3]),
        ]}
      />,
    );

    expect(screen.getByText("担当先スタッフ情報").textContent).toBe("担当先スタッフ情報3");
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "北関東",
      "南関東",
    ]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens a region to its staff, a staff in two regions under both, each linking to its detail", () => {
    const suzuki = chargedStaff("鈴木", [3, 4], "FULL_TIME");
    render(<UserStaffsCard staffs={[chargedStaff("山田", [4]), suzuki]} />);

    fireEvent.click(screen.getByRole("button", { name: "南関東" }));

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "山田 花子アルバイト",
      "鈴木 花子正社員",
    ]);
    expect(within(links[1]!).getByText("正社員")).toBeDefined();
    expect(links[1]!.getAttribute("href")).toBe(href(routes.staff.detail, { id: suzuki.id }));
  });

  it("shows nothing for a user in charge of no staff, as the legacy card did", () => {
    const { container } = render(<UserStaffsCard staffs={[]} />);

    expect(container.childElementCount).toBe(0);
  });
});

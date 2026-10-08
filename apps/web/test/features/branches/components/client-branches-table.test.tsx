// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientBranchesTable } from "@/features/branches/components/client-branches-table";

import { branchRow } from "../fixtures";

afterEach(cleanup);

describe("ClientBranchesTable", () => {
  it("shows the legacy columns, the 連絡担当者 as 担当者名, and no checkboxes", () => {
    render(
      <ClientBranchesTable
        data={[branchRow()]}
        isLoading={false}
        pagination={undefined}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("就業先部署情報")).toBeDefined();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "就業先番号",
      "就業先名",
      "部署名",
      "担当者名",
      "詳細",
    ]);
    expect(screen.getByText("営業部")).toBeDefined();
    expect(screen.getByText("山田 太郎")).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("hands the row to the caller when its chevron is pressed", () => {
    const branch = branchRow();
    const onOpen = vi.fn();
    render(
      <ClientBranchesTable
        data={[branch]}
        isLoading={false}
        pagination={undefined}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新宿店の詳細" }));

    expect(onOpen).toHaveBeenCalledWith(branch);
  });
});

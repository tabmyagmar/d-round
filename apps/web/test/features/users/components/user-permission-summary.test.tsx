// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UserPermissionSummary } from "@/features/users/components/user-permission-summary";

import { CATALOG } from "../catalog-fixture";

afterEach(cleanup);

describe("UserPermissionSummary", () => {
  it("lists the granted permissions under their group headings", () => {
    render(<UserPermissionSummary catalog={CATALOG} permissionKeys={["1101", "1202"]} />);

    expect(screen.getByRole("heading", { name: "マスタ管理" })).toBeDefined();
    expect(screen.getByText("担当者新規登録")).toBeDefined();
    expect(screen.getByText("クライアント情報の一覧・詳細を確認")).toBeDefined();
    expect(screen.queryByText("担当者情報の一覧・詳細を確認")).toBeNull();
  });

  it("says so when nothing is granted", () => {
    render(<UserPermissionSummary catalog={CATALOG} permissionKeys={[]} />);

    expect(screen.getByText("付与されている権限はありません")).toBeDefined();
  });
});

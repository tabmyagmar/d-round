// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PermissionField } from "@/features/users/components/permission-field";

afterEach(cleanup);

describe("PermissionField", () => {
  it("offers 権限（詳細設定） and says the account type's permissions apply until adjusted", () => {
    render(<PermissionField role="manager" value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /権限（詳細設定）/ })).toBeDefined();
    expect(screen.getByText("アカウントタイプの標準の権限")).toBeDefined();
  });

  it("counts the permissions once they are adjusted", () => {
    render(<PermissionField role="manager" value={["1101", "1202"]} onChange={vi.fn()} />);

    expect(screen.getByText("2件の権限を個別に設定しています")).toBeDefined();
  });

  it("does not load the dialog until it is opened", () => {
    render(<PermissionField role="manager" value={undefined} onChange={vi.fn()} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

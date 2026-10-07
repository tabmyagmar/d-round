// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PermissionEditor } from "@/features/users/components/form/permission-editor";

import { CATALOG } from "../../catalog-fixture";

afterEach(cleanup);

const renderEditor = (initial: string[]) => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <PermissionEditor
      catalog={CATALOG}
      roleKeys={["1202"]}
      initial={initial}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  return { onSave, onCancel };
};

const box = (name: string) => screen.getByRole("checkbox", { name: new RegExp(`^${name}`) });

describe("PermissionEditor", () => {
  it("groups the permissions under their catalog groups, ticked as given", () => {
    renderEditor(["1101", "1202"]);

    const users = screen.getByRole("group", { name: "マスタ管理" });
    // The group's select-all box and its two permissions.
    expect(within(users).getAllByRole("checkbox")).toHaveLength(3);
    expect(box("担当者新規登録").getAttribute("aria-checked")).toBe("true");
    expect(box("担当者情報の一覧").getAttribute("aria-checked")).toBe("false");
    expect(box("マスタ管理をすべて選択").getAttribute("aria-checked")).toBe("mixed");
  });

  it("marks the permissions the account type grants as 標準", () => {
    renderEditor([]);

    expect(
      within(box("クライアント情報の一覧").closest("label") as HTMLElement).getByText("標準"),
    ).toBeDefined();
  });

  it("saves the ticked keys in catalog order", () => {
    const { onSave } = renderEditor(["1202"]);

    fireEvent.click(box("クライアント情報編集"));
    fireEvent.click(box("担当者新規登録"));
    fireEvent.click(box("クライアント情報の一覧"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(["1101", "1203"]);
  });

  it("ticks a whole group at once", () => {
    const { onSave } = renderEditor(["1202"]);

    fireEvent.click(box("マスタ管理をすべて選択"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(["1101", "1102", "1202"]);
  });

  it("goes back to the account type's permissions with 標準に戻す", () => {
    const { onSave } = renderEditor(["1101", "1203"]);

    fireEvent.click(screen.getByRole("button", { name: "標準に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(["1202"]);
  });

  it("discards the changes on キャンセル", () => {
    const { onSave, onCancel } = renderEditor(["1202"]);

    fireEvent.click(box("担当者新規登録"));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

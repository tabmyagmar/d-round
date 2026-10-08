// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentTemplatesToolbar } from "@/features/comment-templates/components/comment-templates-toolbar";
import { CommentTemplatesStoreProvider } from "@/features/comment-templates/stores/comment-templates-store-provider";

afterEach(cleanup);

const renderToolbar = (rowSelection: Record<string, true> = {}) => {
  const onCreate = vi.fn();
  const onDeleteSelected = vi.fn();
  render(
    <CommentTemplatesStoreProvider initialState={{ rowSelection }}>
      <CommentTemplatesToolbar
        search=""
        onSearch={vi.fn()}
        onCreate={onCreate}
        onDeleteSelected={onDeleteSelected}
      />
    </CommentTemplatesStoreProvider>,
  );
  return { onCreate, onDeleteSelected };
};

const deleteButton = () => screen.getByRole("button", { name: "選択した定型文を削除" });

describe("CommentTemplatesToolbar", () => {
  it("offers 検索 and 新規作成", () => {
    const { onCreate } = renderToolbar();

    expect(screen.getByRole("searchbox", { name: "タイトル・テキストで検索" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "新規作成" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("keeps 削除 disabled while nothing is selected", () => {
    renderToolbar();

    expect(deleteButton()).toHaveProperty("disabled", true);
  });

  it("deletes the selected templates", () => {
    const { onDeleteSelected } = renderToolbar({ a: true, b: true });

    fireEvent.click(deleteButton());

    expect(onDeleteSelected).toHaveBeenCalledWith(["a", "b"]);
  });
});

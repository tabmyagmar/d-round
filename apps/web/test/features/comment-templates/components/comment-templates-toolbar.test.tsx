// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentTemplatesToolbar } from "@/features/comment-templates/components/comment-templates-toolbar";
import { RowSelectionProvider } from "@/stores/row-selection";

afterEach(cleanup);

const renderToolbar = (rowSelection: Record<string, true> = {}) => {
  const onSearch = vi.fn();
  const onCreate = vi.fn();
  const onDeleteSelected = vi.fn();
  render(
    <RowSelectionProvider initialState={{ rowSelection }}>
      <CommentTemplatesToolbar
        search=""
        onSearch={onSearch}
        onCreate={onCreate}
        onDeleteSelected={onDeleteSelected}
      />
    </RowSelectionProvider>,
  );
  return { onSearch, onCreate, onDeleteSelected };
};

const deleteButton = () => screen.getByRole("button", { name: "選択した定型文を削除" });

describe("CommentTemplatesToolbar", () => {
  it("offers 検索 and 新規作成", () => {
    const { onCreate } = renderToolbar();

    expect(screen.getByRole("searchbox", { name: "タイトル・テキストで検索" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "新規作成" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("searches with the trimmed text once typing pauses", () => {
    vi.useFakeTimers();
    try {
      const { onSearch } = renderToolbar();

      fireEvent.change(screen.getByRole("searchbox", { name: "タイトル・テキストで検索" }), {
        target: { value: " 挨拶 " },
      });
      expect(onSearch).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onSearch).toHaveBeenCalledWith("挨拶");
    } finally {
      vi.useRealTimers();
    }
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

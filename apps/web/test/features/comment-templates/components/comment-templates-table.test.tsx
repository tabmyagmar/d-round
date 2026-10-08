// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentTemplatesTable } from "@/features/comment-templates/components/comment-templates-table";
import type { CommentTemplateRow } from "@/features/comment-templates/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { commentTemplateRow } from "../fixtures";

afterEach(cleanup);

const renderTable = (rows: CommentTemplateRow[]) => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <RowSelectionProvider>
      <CommentTemplatesTable
        data={rows}
        isLoading={false}
        pagination={{
          page: 1,
          totalPages: 1,
          total: rows.length,
          hasPrev: false,
          hasNext: false,
          onPageChange: vi.fn(),
        }}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </RowSelectionProvider>,
  );
  return { onEdit, onDelete };
};

describe("CommentTemplatesTable", () => {
  it("titles the card 全定型文数 with the total", () => {
    renderTable([commentTemplateRow(), commentTemplateRow({ short: "挨拶" })]);

    expect(screen.getByText("全定型文数").textContent).toBe("全定型文数2");
  });

  it("shows the legacy columns in the legacy order", () => {
    renderTable([commentTemplateRow()]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "使用先メニュー",
      "タイトル",
      "作成日",
      "操作",
    ]);
  });

  it("shows a row's menus, title and creation date", () => {
    renderTable([
      commentTemplateRow({
        types: ["STAFF", "WORKFLOW"],
        short: "承認",
        createdAt: new Date(2026, 9, 8),
      }),
    ]);

    expect(screen.getByText("ワークフロー承認画面用コメント、スタッフ管理")).toBeDefined();
    expect(screen.getByText("承認")).toBeDefined();
    expect(screen.getByText("2026/10/08")).toBeDefined();
  });

  it("offers 定型文編集 and 定型文削除 in the row's menu", async () => {
    const row = commentTemplateRow({ short: "承認" });
    const { onEdit, onDelete } = renderTable([row]);

    fireEvent.click(screen.getByRole("button", { name: "承認の操作" }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: "定型文編集" }));
    expect(onEdit).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole("button", { name: "承認の操作" }));
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitem", { name: "定型文削除" }));
    expect(onDelete).toHaveBeenCalledWith(row);
  });
});

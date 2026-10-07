import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaginationBar, pageItems } from "../../../src/components/composed/pagination-bar";
import type { PaginationBarProps } from "../../../src/components/composed/pagination-bar";

afterEach(cleanup);

describe("pageItems", () => {
  it("lists every page up to seven", () => {
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first and last page and three around the current one", () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, "ellipsis", 20]);
    expect(pageItems(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
    expect(pageItems(20, 20)).toEqual([1, "ellipsis", 17, 18, 19, 20]);
  });
});

const renderBar = (props: Partial<PaginationBarProps> = {}) => {
  const onPageChange = vi.fn();
  render(
    <PaginationBar
      page={5}
      totalPages={20}
      hasPrev
      hasNext
      onPageChange={onPageChange}
      {...props}
    />,
  );
  return onPageChange;
};

describe("PaginationBar", () => {
  it("moves to the first, previous, next and last page", () => {
    const onPageChange = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Last page" }));

    expect(onPageChange.mock.calls).toEqual([[1], [4], [6], [20]]);
  });

  it("marks the current page and moves to a numbered one", () => {
    const onPageChange = renderBar();

    expect(screen.getByRole("button", { name: "5" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "6" }));

    expect(onPageChange).toHaveBeenCalledWith(6);
  });

  it("disables the way back on the first page", () => {
    renderBar({ page: 1, hasPrev: false });

    expect(screen.getByRole("button", { name: "First page" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", false);
  });

  it("renders nothing while there is one page", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationBar
        page={1}
        totalPages={1}
        hasPrev={false}
        hasNext={false}
        onPageChange={onPageChange}
      />,
    );

    expect(container.childElementCount).toBe(0);
  });

  it("jumps to the page typed into the box, within the range", () => {
    const onPageChange = renderBar();
    const box = screen.getByRole("textbox", { name: "Go to page" });

    fireEvent.change(box, { target: { value: "12" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.change(box, { target: { value: "99" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(onPageChange.mock.calls).toEqual([[12], [20]]);
    expect(box).toHaveProperty("value", "");
  });

  it("ignores what is not a page number", () => {
    const onPageChange = renderBar();
    const box = screen.getByRole("textbox", { name: "Go to page" });

    fireEvent.change(box, { target: { value: "abc" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("uses the labels it is given", () => {
    renderBar({
      labels: {
        first: "最初のページ",
        previous: "前のページ",
        next: "次のページ",
        last: "最後のページ",
        pageInput: "ページ",
      },
    });

    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "ページ" })).toHaveProperty("placeholder", "ページ");
  });
});

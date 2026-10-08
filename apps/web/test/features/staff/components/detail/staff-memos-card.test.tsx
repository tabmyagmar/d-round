// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffMemosCard } from "@/features/staff/components/detail/staff-memos-card";
import type { StaffDetail } from "@/features/staff/types";

afterEach(cleanup);

const memo = (
  memoType: StaffDetail["memos"][number]["memoType"],
  content: string,
): StaffDetail["memos"][number] => ({
  id: crypto.randomUUID(),
  staffId: "staff-1",
  sortOrder: 0,
  memoType,
  content,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
});

describe("StaffMemosCard", () => {
  it("shows each memo under its type, the added ones as メモ", () => {
    render(
      <StaffMemosCard
        memos={[
          memo("STAFF_MEMO", "週3日勤務希望"),
          memo("CUSTOM", "鍵を貸与"),
          memo("CUSTOM", "制服Mサイズ"),
        ]}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "スタッフメモ",
      "メモ",
      "メモ",
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "週3日勤務希望",
      "鍵を貸与",
      "制服Mサイズ",
    ]);
  });

  it("says メモはありません without memos", () => {
    render(<StaffMemosCard memos={[]} />);

    expect(screen.getByText("メモはありません")).toBeDefined();
  });
});

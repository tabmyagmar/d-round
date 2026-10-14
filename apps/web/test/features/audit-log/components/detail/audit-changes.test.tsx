// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuditChanges } from "@/features/audit-log/components/detail/audit-changes";

afterEach(cleanup);

const cellsOf = (row: HTMLElement) =>
  [...row.querySelectorAll("td")].map((cell) => cell.textContent);

describe("AuditChanges", () => {
  it("names each field by its entity's labels, with the value before and after", () => {
    render(
      <AuditChanges
        entityType="Staff"
        changes={[
          { field: "branchName", before: "新宿支店", after: "渋谷支店" },
          { field: "memos", before: null, after: "スタッフメモ: 面談済み" },
        ]}
      />,
    );

    const [, branch, memo] = screen.getAllByRole("row");
    expect(cellsOf(branch!)).toEqual(["支店名", "新宿支店", "渋谷支店"]);
    expect(cellsOf(memo!)).toEqual(["メモ", "—", "スタッフメモ: 面談済み"]);
  });

  it("says only that a masked field changed, and that a cut value was cut", () => {
    render(
      <AuditChanges
        entityType="Staff"
        changes={[
          { field: "phoneNumber", masked: true },
          { field: "memos", before: null, after: "長い", truncated: true },
        ]}
      />,
    );

    const [, phone, memo] = screen.getAllByRole("row");
    expect(cellsOf(phone!)).toEqual(["電話番号", "変更あり（非表示）"]);
    expect(cellsOf(memo!)[2]).toBe("長い（一部省略）");
  });

  it("says so when no field changed", () => {
    render(<AuditChanges entityType="User" changes={[]} />);

    expect(screen.getByText("変更された項目はありません")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditChange } from "@repo/validation";

import { AuditChanges } from "@/features/audit-log/components/detail/audit-changes";

// jsdom has no matchMedia; useIsMobile subscribes to one and reads the width from innerWidth.
const stubViewport = (width: number) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

beforeEach(() => {
  stubViewport(1024);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("stacks each field below md, inside the drawer", () => {
    stubViewport(375);
    render(
      <AuditChanges
        entityType="Staff"
        changes={[
          { field: "branchName", before: "新宿支店", after: "渋谷支店" },
          { field: "phoneNumber", masked: true },
        ]}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    const [branch, phone] = screen.getAllByRole("listitem");
    expect(branch?.textContent).toBe("支店名変更前新宿支店変更後渋谷支店");
    expect(phone?.textContent).toBe("電話番号変更あり（非表示）");
  });

  it("says a cut value was cut when it was cleared, in the table and stacked", () => {
    const cleared: AuditChange[] = [
      { field: "memos", before: "長い", after: null, truncated: true },
    ];
    render(<AuditChanges entityType="Staff" changes={cleared} />);
    expect(cellsOf(screen.getAllByRole("row")[1]!)).toEqual(["メモ", "長い", "—（一部省略）"]);
    cleanup();

    stubViewport(375);
    render(<AuditChanges entityType="Staff" changes={cleared} />);
    expect(screen.getByRole("listitem").textContent).toBe("メモ変更前長い変更後—（一部省略）");
  });

  it("says so when no field changed", () => {
    render(<AuditChanges entityType="User" changes={[]} />);

    expect(screen.getByText("変更された項目はありません")).toBeDefined();
  });
});

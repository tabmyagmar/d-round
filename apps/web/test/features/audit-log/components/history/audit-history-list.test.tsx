// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuditHistoryList } from "@/features/audit-log/components/history/audit-history-list";

import { auditLogDetail } from "../../fixtures";

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

describe("AuditHistoryList", () => {
  it("lists each entry's time, actor and action, opening into its changed fields", () => {
    render(
      <AuditHistoryList
        entries={[auditLogDetail()]}
        hasMore={false}
        loadingMore={false}
        onMore={vi.fn()}
      />,
    );

    const entry = screen.getByRole("button", { name: /2026\/10\/14 09:30:00/u });
    expect(entry.textContent).toContain("鈴木 花子");
    expect(entry.textContent).toContain("クライアント情報編集");
    expect(screen.queryByText("クライアント名")).toBeNull();

    fireEvent.click(entry);

    expect(screen.getByText("クライアント名")).toBeDefined();
    expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull();
  });

  it("offers もっと見る while more entries wait, and says when there is no entry", () => {
    const onMore = vi.fn();
    render(
      <AuditHistoryList
        entries={[auditLogDetail({ status: "FAILURE" })]}
        hasMore
        loadingMore={false}
        onMore={onMore}
      />,
    );

    expect(screen.getByText("エラー")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));
    expect(onMore).toHaveBeenCalledOnce();

    cleanup();
    render(<AuditHistoryList entries={[]} hasMore={false} loadingMore={false} onMore={vi.fn()} />);
    expect(screen.getByText("変更履歴はありません")).toBeDefined();
  });
});

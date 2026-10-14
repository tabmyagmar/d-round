// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuditLogDetail } from "@/features/audit-log/components/detail/audit-log-detail";

import { auditLogDetail } from "../../fixtures";

afterEach(cleanup);

describe("AuditLogDetail", () => {
  it("shows 実行者, 操作内容, 変更内容 and 実行環境 of a row", () => {
    render(<AuditLogDetail log={auditLogDetail()} />);

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "実行者",
      "操作内容",
      "変更内容",
      "実行環境",
    ]);
    expect(screen.getByText("鈴木 花子")).toBeDefined();
    expect(screen.getByText("アドミン")).toBeDefined();
    expect(screen.getByText("2026/10/14 09:30:00")).toBeDefined();
    expect(screen.getByText("クライアント 1024 株式会社サンプル")).toBeDefined();
    expect(screen.getByText("クライアント名")).toBeDefined();
    expect(screen.getByText("203.0.113.7")).toBeDefined();
    expect(screen.queryByText("エラーコード")).toBeNull();
  });

  it("shows a failure's code and no changed field", () => {
    render(
      <AuditLogDetail
        log={auditLogDetail({ status: "FAILURE", errorCode: "FORBIDDEN", changes: null })}
      />,
    );

    expect(screen.getByText("エラー")).toBeDefined();
    expect(screen.getByText("FORBIDDEN")).toBeDefined();
    expect(screen.getByText("変更された項目はありません")).toBeDefined();
  });
});

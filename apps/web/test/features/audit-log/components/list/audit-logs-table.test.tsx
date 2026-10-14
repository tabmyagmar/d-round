// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditLogsTable } from "@/features/audit-log/components/list/audit-logs-table";
import type { AuditLogRow } from "@/features/audit-log/types";

import { auditLogRow } from "../../fixtures";

afterEach(cleanup);

const renderTable = (rows: AuditLogRow[], total = rows.length) =>
  render(
    <AuditLogsTable
      data={rows}
      isLoading={false}
      pagination={{
        page: 1,
        totalPages: 1,
        total,
        hasPrev: false,
        hasNext: false,
        onPageChange: vi.fn(),
      }}
    />,
  );

describe("AuditLogsTable", () => {
  it("titles the card ログ履歴 with the total, the legacy columns and 対象", () => {
    renderTable([auditLogRow()], 31);

    expect(screen.getByText("ログ履歴").textContent).toBe("ログ履歴31");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "日付",
      "時間",
      "担当者",
      "アクション",
      "対象",
      "ステータス",
    ]);
  });

  it("shows a row's day and time in Japan, its action, target and status", () => {
    renderTable([auditLogRow()]);

    const [, row] = screen.getAllByRole("row");
    expect(within(row!).getByText("2026/10/14")).toBeDefined();
    expect(within(row!).getByText("09:30")).toBeDefined();
    expect(within(row!).getByText("鈴木 花子")).toBeDefined();
    expect(within(row!).getByText("クライアント情報編集")).toBeDefined();
    expect(within(row!).getByText("1024 株式会社サンプル")).toBeDefined();
    expect(within(row!).getByText("成功")).toBeDefined();
  });

  it("names the system, a typed address and a failure", () => {
    renderTable([
      auditLogRow({
        actorType: "SYSTEM",
        actorName: null,
        actorEmail: null,
        action: "system.auditLogPurge",
        entityType: "AuditLog",
        entityLabel: "2026/07/16より前",
      }),
      auditLogRow({
        actorType: "ANONYMOUS",
        actorName: null,
        actorEmail: "typed@example.com",
        action: "auth.signIn",
        entityType: "User",
        entityLabel: "typed@example.com",
        status: "FAILURE",
        errorCode: "INVALID_EMAIL_OR_PASSWORD",
      }),
    ]);

    const [, purge, signIn] = screen.getAllByRole("row");
    expect(within(purge!).getByText("システム")).toBeDefined();
    expect(within(purge!).getByText("保存期間切れログ削除")).toBeDefined();
    expect(within(signIn!).getAllByText("typed@example.com")).toHaveLength(2);
    expect(within(signIn!).getByText("エラー")).toBeDefined();
  });
});

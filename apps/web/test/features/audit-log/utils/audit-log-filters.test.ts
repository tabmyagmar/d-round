import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  auditLogFiltersOf,
  auditLogFilterTags,
  removalOf,
} from "@/features/audit-log/utils/audit-log-filters";

describe("audit log filters", () => {
  it("reads no filter from an empty query", () => {
    const filters = auditLogFiltersOf({});

    expect(filters).toEqual({
      search: "",
      actions: [],
      entityTypes: [],
      statuses: [],
      from: null,
      to: null,
    });
    expect(auditLogFilterTags(filters)).toEqual([]);
  });

  it("tags アクション, 対象, ステータス and 期間 in the popover's order, by their labels", () => {
    const filters = auditLogFiltersOf({
      actions: ["client.update", "auth.signIn"],
      entityTypes: ["Client"],
      statuses: ["FAILURE"],
      from: "2026-10-01",
      to: "2026-10-14",
    });

    expect(auditLogFilterTags(filters)).toEqual([
      { key: "actions", label: "アクション", value: "クライアント情報編集、ログイン" },
      { key: "entityTypes", label: "対象", value: "クライアント" },
      { key: "statuses", label: "ステータス", value: "エラー" },
      { key: "period", label: "期間", value: "2026/10/01 〜 2026/10/14" },
    ]);
    expect(activeFilterCount(filters)).toBe(4);
  });

  it("shows an open end of the period empty, and removes both ends with its tag", () => {
    expect(auditLogFilterTags(auditLogFiltersOf({ from: "2026-10-01" }))).toEqual([
      { key: "period", label: "期間", value: "2026/10/01 〜 " },
    ]);
    expect(removalOf("period")).toEqual({ from: null, to: null });
    expect(removalOf("actions")).toEqual({ actions: null });
  });
});

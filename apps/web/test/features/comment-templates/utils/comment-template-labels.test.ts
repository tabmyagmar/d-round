import { describe, expect, it } from "vitest";

import {
  COMMENT_FOR_OPTIONS,
  typesLabel,
} from "@/features/comment-templates/utils/comment-template-labels";

describe("comment template labels", () => {
  it("names the four menus as the legacy app, in its order", () => {
    expect(COMMENT_FOR_OPTIONS).toEqual([
      { value: "WORKFLOW", label: "ワークフロー承認画面用コメント" },
      { value: "APPLICATION", label: "ワークフロー一覧用メモ" },
      { value: "CLIENT", label: "クライアント管理" },
      { value: "STAFF", label: "スタッフ管理" },
    ]);
  });

  it("joins a row's menus in the legacy order", () => {
    expect(typesLabel(["STAFF", "WORKFLOW"])).toBe("ワークフロー承認画面用コメント、スタッフ管理");
    expect(typesLabel([])).toBe("");
  });
});

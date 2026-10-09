// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BranchDetail } from "@/features/branches/components/detail/branch-detail";

import { branchRow } from "../../fixtures";

afterEach(cleanup);

/** The value next to a label in a card's description list. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("BranchDetail", () => {
  it("shows the legacy four cards with their rows in the legacy order", () => {
    render(<BranchDetail branch={branchRow()} />);

    expect(
      screen
        .getAllByText(/情報$|^メモ$/, { selector: "[data-slot=card-title]" })
        .map((title) => title.textContent),
    ).toEqual(["就業先部署情報", "就業先部署・住所情報", "連絡担当者情報", "メモ"]);
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "クライアント名",
      "就業先番号",
      "就業先名",
      "就業先名（カタカナ）",
      "エリア",
      "地域",
      "担当者",
      "部署番号",
      "部署名",
      "部署名（カタカナ）",
      "郵便番号",
      "住所",
      "FAX",
      "姓",
      "名",
      "役職",
      "セイ",
      "メイ",
      "メールアドレス",
    ]);
  });

  it("names the values: the client, area, region, 担当者, the whole address and the 役職", () => {
    render(<BranchDetail branch={branchRow({ memo: "鍵は受付" })} />);

    expect(valueOf("クライアント名")).toBe("株式会社テスト");
    expect(valueOf("エリア")).toBe("東日本");
    expect(valueOf("地域")).toBe("南関東");
    expect(valueOf("担当者")).toBe("佐藤 一郎");
    expect(valueOf("郵便番号")).toBe("〒160-0022");
    expect(valueOf("住所")).toBe("東京都新宿区新宿1-2-3");
    expect(valueOf("FAX")).toBe("—");
    expect(valueOf("役職")).toBe("リーダー");
    expect(screen.getByText("鍵は受付")).toBeDefined();
  });

  it("says 特に無し without a memo, as the legacy detail", () => {
    render(<BranchDetail branch={branchRow()} />);

    expect(screen.getByText("特に無し")).toBeDefined();
  });
});

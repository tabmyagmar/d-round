// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BranchFormConfirm } from "@/features/branches/components/form/branch-form-confirm";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

/** The value next to a label in a card's description list. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("BranchFormConfirm", () => {
  it("shows the first step's values in the legacy four cards, by name", () => {
    render(
      <BranchFormConfirm
        title="就業先部署登録"
        values={{
          clientId: "client-1",
          number: 3,
          name: "新宿店",
          nameKana: "シンジュクテン",
          area: "WEST",
          regionCode: 7,
          chargerUserIds: ["c1"],
          departmentNumber: 10,
          departmentName: "営業部",
          departmentNameKana: "エイギョウブ",
          departmentFax: "03-1234-5679",
          address: {
            postCode: "1600022",
            address1: "1-2-3",
            pref: "東京都",
            cityTown: "新宿区新宿",
          },
          contactLastName: "山田",
          contactFirstName: "太郎",
          contactLastNameKana: "ヤマダ",
          contactFirstNameKana: "タロウ",
          contactPosition: "LEADER",
          contactEmail: "yamada@example.com",
          memo: "鍵は受付",
        }}
        hierarchy={HIERARCHY}
        clientName="株式会社テスト"
        chargers={[{ id: "c1", name: "佐藤 一郎" }]}
      />,
    );

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
      "住所(県名)",
      "住所(市町村名)",
      "住所",
      "FAX",
      "姓",
      "名",
      "役職",
      "セイ",
      "メイ",
      "メールアドレス",
    ]);
    expect(valueOf("クライアント名")).toBe("株式会社テスト");
    expect(valueOf("エリア")).toBe("西日本");
    expect(valueOf("地域")).toBe("関西");
    expect(valueOf("担当者")).toBe("佐藤 一郎");
    expect(valueOf("郵便番号")).toBe("〒160-0022");
    expect(valueOf("役職")).toBe("リーダー");
    expect(screen.getByText("鍵は受付")).toBeDefined();
  });
});

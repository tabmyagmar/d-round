// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ClientFormConfirm } from "@/features/clients/components/form/client-form-confirm";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

/** The value next to a label in the card's description list. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("ClientFormConfirm", () => {
  it("shows every value of the first step in the legacy order, by name", () => {
    render(
      <ClientFormConfirm
        title="クライアント情報登録"
        values={{
          number: 101,
          name: "株式会社テスト",
          nameKana: "カブシキガイシャテスト",
          areas: ["EAST", "WEST"],
          regionCodes: [4, 7],
          chargerUserIds: ["c1"],
          address: {
            postCode: "1600022",
            address1: "1-2-3",
            pref: "東京都",
            cityTown: "新宿区新宿",
          },
          phoneNumber: "03-1234-5678",
          fax: null,
          webUrl: "example.com",
          orderTypes: ["CONTRACT_WORK", "SPOT_WORK"],
        }}
        hierarchy={HIERARCHY}
        chargers={[{ id: "c1", name: "佐藤 一郎" }]}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "クライアント番号",
      "クライアント名",
      "クライアント名（カタカナ）",
      "担当者",
      "エリア",
      "地域",
      "郵便番号",
      "住所(県名)",
      "住所(市町村名)",
      "住所",
      "電話番号",
      "FAX",
      "URL",
      "受注区分",
    ]);
    expect(valueOf("担当者")).toBe("佐藤 一郎");
    expect(valueOf("エリア")).toBe("東日本、西日本");
    expect(valueOf("地域")).toBe("南関東、関西");
    expect(valueOf("郵便番号")).toBe("〒160-0022");
    expect(valueOf("FAX")).toBe("—");
    expect(valueOf("受注区分")).toBe("業務請負、スポット");
  });
});

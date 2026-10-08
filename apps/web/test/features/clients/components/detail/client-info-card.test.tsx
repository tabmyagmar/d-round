// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ClientInfoCard } from "@/features/clients/components/detail/client-info-card";

import { clientDetail } from "../../fixtures";

afterEach(cleanup);

/** The value next to a label in the card's description list. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("ClientInfoCard", () => {
  it("shows the legacy rows in the legacy order, the post code labelled 郵便番号", () => {
    render(<ClientInfoCard client={clientDetail()} />);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "クライアント番号",
      "クライアント名",
      "カタカナ",
      "エリア",
      "地域",
      "担当者",
      "受注区分",
      "郵便番号",
      "住所",
      "電話番号",
      "FAX",
      "URL",
    ]);
  });

  it("names the values the legacy way, the address whole", () => {
    render(
      <ClientInfoCard
        client={clientDetail({ webUrl: "example.com", orderTypes: ["DISPATCH", "SPOT_WORK"] })}
      />,
    );

    expect(valueOf("クライアント番号")).toBe("101");
    expect(valueOf("エリア")).toBe("東日本");
    expect(valueOf("地域")).toBe("南関東");
    expect(valueOf("担当者")).toBe("佐藤 一郎");
    expect(valueOf("受注区分")).toBe("派遣、スポット");
    expect(valueOf("郵便番号")).toBe("〒160-0022");
    expect(valueOf("住所")).toBe("東京都新宿区新宿1-2-3");
    expect(valueOf("URL")).toBe("example.com");
    expect(valueOf("FAX")).toBe("—");
  });
});

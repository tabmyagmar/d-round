// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { StaffInfoCard } from "@/features/staff/components/detail/staff-info-card";

import { staffDetail } from "../../fixtures";

beforeAll(() => {
  // 年齢 depends on today; pin it so the fixture's 1990-04-01 birthday is 36.
  vi.useFakeTimers({ now: new Date("2026-10-08T03:00:00Z"), toFake: ["Date"] });
  return () => {
    vi.useRealTimers();
  };
});

afterEach(cleanup);

/** The value next to a label in the card's description list. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("StaffInfoCard", () => {
  it("shows the legacy rows in the legacy order, with 役職 after 支店名", () => {
    render(<StaffInfoCard staff={staffDetail()} />);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "雇用区分",
      "スタッフ番号",
      "姓",
      "名",
      "セイ",
      "メイ",
      "エリア",
      "地域",
      "都道府県",
      "担当者名",
      "支店名",
      "役職",
      "生年月日",
      "年齢",
      "性別",
    ]);
  });

  it("names the values the legacy way: labels, the region names, the age", () => {
    render(<StaffInfoCard staff={staffDetail()} />);

    expect(valueOf("雇用区分")).toBe("アルバイト");
    expect(valueOf("スタッフ番号")).toBe("101");
    expect(valueOf("エリア")).toBe("東日本");
    expect(valueOf("地域")).toBe("南関東");
    expect(valueOf("都道府県")).toBe("東京都");
    expect(valueOf("役職")).toBe("スタッフ");
    expect(valueOf("生年月日")).toBe("1990/04/01");
    expect(valueOf("年齢")).toBe("36歳");
    expect(valueOf("性別")).toBe("女性");
  });

  it("lists the current 担当者 only", () => {
    render(<StaffInfoCard staff={staffDetail()} />);

    expect(valueOf("担当者名")).toBe("佐藤 一郎");
  });

  it("shows — for what the staff does not have", () => {
    render(
      <StaffInfoCard
        staff={staffDetail({ birthday: null, position: null, branchName: null, prefectures: [] })}
      />,
    );

    for (const label of ["都道府県", "支店名", "役職", "生年月日", "年齢"]) {
      expect(valueOf(label)).toBe("—");
    }
  });
});

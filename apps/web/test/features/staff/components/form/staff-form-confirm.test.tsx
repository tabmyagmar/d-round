// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { StaffFormValues } from "@repo/validation";

import { StaffFormConfirm } from "@/features/staff/components/form/staff-form-confirm";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

beforeAll(() => {
  // 年齢 depends on today: 1990-04-01 is 36 on 2026-10-08.
  vi.useFakeTimers({ now: new Date(2026, 9, 8, 12), toFake: ["Date"] });
  return () => {
    vi.useRealTimers();
  };
});

afterEach(cleanup);

const VALUES: StaffFormValues = {
  employeeType: "PART_TIME",
  employeeNumber: 101,
  lastName: "山田",
  firstName: "花子",
  lastNameKana: "ヤマダ",
  firstNameKana: "ハナコ",
  gender: "FEMALE",
  birthday: "1990-04-01",
  position: "STAFF",
  branchName: "新宿支店",
  email: null,
  phoneNumber: "090-1234-5678",
  emergencyPhoneNumber: null,
  areas: ["EAST"],
  regionCodes: [4],
  prefectureCodes: [13],
  chargerUserIds: ["c1"],
  address: { postCode: "160-0022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
  jobHistories: [
    { hireDate: "2020-04-01", resignationDate: "2022-03-31", resignationReason: "転居" },
    { hireDate: "2024-04-01", resignationDate: null, resignationReason: null },
  ],
  familyMembers: [
    {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: null,
      firstNameKana: null,
      relation: "HUSBAND",
      birthday: null,
    },
  ],
  memos: [
    { memoType: "STAFF_MEMO", content: "週3日勤務希望" },
    { memoType: "CUSTOM", content: "" },
  ],
  resumes: [
    {
      id: "0199a1b2-0000-7000-8000-000000000001",
      name: "履歴書_2026.pdf",
      size: 1024,
      type: "application/pdf",
      url: "https://storage.example/read",
    },
    {
      id: "0199a1b2-0000-7000-8000-000000000002",
      name: "職務経歴書.pdf",
      size: 2048,
      type: "application/pdf",
    },
  ],
};

/** The value next to a label. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe("StaffFormConfirm", () => {
  it("names what the form holds as codes and ids, the legacy way", () => {
    render(
      <StaffFormConfirm
        title="スタッフ情報登録"
        values={VALUES}
        hierarchy={HIERARCHY}
        chargers={[{ id: "c1", name: "佐藤 一郎" }]}
      />,
    );

    expect(valueOf("雇用区分")).toBe("アルバイト");
    expect(valueOf("担当者名")).toBe("佐藤 一郎");
    expect(valueOf("氏名")).toBe("山田 花子");
    expect(valueOf("エリア")).toBe("東日本");
    expect(valueOf("地域")).toBe("南関東");
    expect(valueOf("都道府県")).toBe("東京都");
    expect(valueOf("生年月日")).toBe("1990/04/01");
    expect(valueOf("年齢")).toBe("36歳");
    expect(valueOf("役職")).toBe("スタッフ");
    expect(valueOf("郵便番号")).toBe("〒160-0022");
  });

  it("numbers the repeated rows and shows — for what is empty", () => {
    render(
      <StaffFormConfirm
        title="スタッフ情報登録"
        values={VALUES}
        hierarchy={HIERARCHY}
        chargers={[]}
      />,
    );

    expect(valueOf("1. 退職日")).toBe("2022/03/31");
    expect(valueOf("1. 退職理由")).toBe("転居");
    expect(valueOf("2. 退職日")).toBe("—");
    expect(valueOf("1. 続柄")).toBe("夫");
    expect(valueOf("1. スタッフメモ")).toBe("週3日勤務希望");
    expect(valueOf("2. メモ")).toBe("—");
  });

  it("lists the 履歴書 last, a stored file as a link, and 未アップロード without any", () => {
    const { rerender } = render(
      <StaffFormConfirm
        title="スタッフ情報登録"
        values={VALUES}
        hierarchy={HIERARCHY}
        chargers={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "履歴書_2026.pdf" }).getAttribute("href")).toBe(
      "https://storage.example/read",
    );
    expect(screen.getByText("職務経歴書.pdf").closest("a")).toBeNull();

    rerender(
      <StaffFormConfirm
        title="スタッフ情報登録"
        values={{ ...VALUES, resumes: [] }}
        hierarchy={HIERARCHY}
        chargers={[]}
      />,
    );
    expect(screen.getByText("未アップロード")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StaffFormValues } from "@repo/validation";

import { StaffForm } from "@/features/staff/components/form/staff-form";
import type { StaffFormProps } from "@/features/staff/components/form/staff-form";
import type { ChargerOption } from "@/features/staff/types";
import { emptyStaffValues } from "@/features/staff/utils/staff-form-input";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

const CHARGER: ChargerOption = {
  id: "019a0000-0000-7000-8000-0000000000c1",
  name: "佐藤 一郎",
  lastName: "佐藤",
  firstName: "一郎",
  lastNameKana: "サトウ",
  firstNameKana: "イチロウ",
};

/** A form whose every field is valid: 東日本, 南関東, 東京都, one 担当者, one memo with text. */
const VALID: StaffFormValues = {
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
  chargerUserIds: [CHARGER.id],
  address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
  jobHistories: [{ hireDate: "2026-04-01", resignationDate: null, resignationReason: null }],
  familyMembers: [],
  memos: [
    { memoType: "STAFF_MEMO", content: "週3日勤務希望" },
    { memoType: "ENTRY_EXIT", content: "" },
  ],
};

const renderForm = (overrides: Partial<StaffFormProps> = {}) => {
  const onSubmit = vi.fn();
  const findChargers = vi.fn((_regionCodes: number[]) => Promise.resolve([CHARGER]));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StaffForm
          title="スタッフ情報登録"
          defaultValues={VALID}
          hierarchy={HIERARCHY}
          findChargers={findChargers}
          findAddress={() => Promise.resolve({ pref: "東京都", city: "新宿区", town: "新宿" })}
          isEmployeeNumberFree={() => Promise.resolve(true)}
          templates={[]}
          cancelHref="/admin/staff"
          submitLabel="追加"
          pendingLabel="追加中…"
          pending={false}
          onSubmit={onSubmit}
          {...overrides}
        />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { onSubmit, findChargers };
};

/** The step the stepper marks as current. */
const currentStep = () =>
  screen.getByRole("navigation", { name: "入力ステップ" }).querySelector('[aria-current="step"]')
    ?.textContent;

const next = () => {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
};

describe("StaffForm", () => {
  it("refuses 次へ on an empty first step and shows the field errors", async () => {
    renderForm({ defaultValues: emptyStaffValues() });

    next();

    expect(await screen.findByText("雇用区分を選択してください")).toBeDefined();
    expect(screen.getByText("生年月日を入力してください")).toBeDefined();
    expect(screen.getByText("担当者を選択してください")).toBeDefined();
    expect(currentStep()).toContain("基本情報");
  });

  it("keeps the first step when the スタッフ番号 is taken, with the legacy message", async () => {
    renderForm({ isEmployeeNumberFree: () => Promise.resolve(false) });

    next();

    expect(await screen.findByText("このスタッフ番号は既に使用されています")).toBeDefined();
    expect(currentStep()).toContain("基本情報");
  });

  it("offers the 担当者 of the chosen regions", async () => {
    const { findChargers } = renderForm();

    expect(await screen.findByText("佐藤 一郎")).toBeDefined();
    expect(findChargers).toHaveBeenCalledWith([4]);
  });

  it("steps through to 確認 and sends the input without the address parts or empty memos", async () => {
    const { onSubmit } = renderForm();
    await screen.findByText("佐藤 一郎");

    next();
    expect(await screen.findByText("家族情報登録")).toBeDefined();
    expect(currentStep()).toContain("家族情報・メモ");

    next();
    expect(await screen.findByText("〒160-0022")).toBeDefined();
    expect(currentStep()).toContain("確認");
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      address: { postCode: "1600022", address1: "1-2-3" },
      chargerUserIds: [CHARGER.id],
      memos: [{ memoType: "STAFF_MEMO", content: "週3日勤務希望" }],
    });
    expect(onSubmit.mock.calls[0]?.[0].address).not.toHaveProperty("pref");
  });

  it("goes back with 戻る and through a completed step of the stepper", async () => {
    renderForm();
    await screen.findByText("佐藤 一郎");
    next();
    await screen.findByText("家族情報登録");
    next();
    await screen.findByText("〒160-0022");

    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(currentStep()).toContain("家族情報・メモ");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "入力ステップ" })).getByRole("button", {
        name: "基本情報",
      }),
    );
    expect(currentStep()).toContain("基本情報");
    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "キャンセル" }).getAttribute("href")).toBe(
      "/admin/staff",
    );
  });
});

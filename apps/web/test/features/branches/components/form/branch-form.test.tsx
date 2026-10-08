// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BranchFormValues } from "@repo/validation";

import { BranchForm } from "@/features/branches/components/form/branch-form";
import type { BranchFormProps } from "@/features/branches/components/form/branch-form";
import { emptyBranchValues } from "@/features/branches/utils/branch-form-input";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would; `click` alone does not. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const CLIENT = { id: "019a0000-0000-7000-8000-0000000000a1", name: "株式会社テスト" };
const CHARGER = { id: "019a0000-0000-7000-8000-0000000000c1", name: "佐藤 一郎" };

/** A form whose every field is valid: 株式会社テスト, 東日本 / 南関東, one 担当者. */
const VALID: BranchFormValues = {
  clientId: CLIENT.id,
  number: 3,
  name: "新宿店",
  nameKana: "シンジュクテン",
  area: "EAST",
  regionCode: 4,
  chargerUserIds: [CHARGER.id],
  departmentNumber: 10,
  departmentName: "営業部",
  departmentNameKana: "エイギョウブ",
  departmentFax: null,
  address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
  contactLastName: "山田",
  contactFirstName: "太郎",
  contactLastNameKana: "ヤマダ",
  contactFirstNameKana: "タロウ",
  contactPosition: "LEADER",
  contactEmail: "yamada@example.com",
  memo: null,
};

const renderForm = (overrides: Partial<BranchFormProps> = {}) => {
  const onSubmit = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BranchForm
          title="就業先部署登録"
          defaultValues={VALID}
          hierarchy={HIERARCHY}
          findClients={() => Promise.resolve([CLIENT])}
          storedClient={CLIENT}
          chargerOptions={[CHARGER]}
          chargersLoading={false}
          findAddress={() => Promise.resolve({ pref: "東京都", city: "新宿区", town: "新宿" })}
          cancelHref="/admin/branch"
          submitLabel="追加"
          pendingLabel="追加中…"
          pending={false}
          onSubmit={onSubmit}
          {...overrides}
        />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { onSubmit };
};

/** The step the stepper marks as current. */
const currentStep = () =>
  screen.getByRole("navigation", { name: "入力ステップ" }).querySelector('[aria-current="step"]')
    ?.textContent;

const next = () => {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
};

describe("BranchForm", () => {
  it("refuses 次へ on an empty form and shows the legacy field errors", async () => {
    renderForm({ defaultValues: emptyBranchValues() });

    next();

    expect(await screen.findByText("クライアントを選択してください")).toBeDefined();
    expect(screen.getByText("就業先名を入力してください")).toBeDefined();
    expect(screen.getByText("エリアを選択してください")).toBeDefined();
    expect(screen.getByText("地域を選択してください")).toBeDefined();
    expect(screen.getByText("部署名を入力してください")).toBeDefined();
    expect(screen.getByText("役職を選択してください")).toBeDefined();
    expect(screen.getByText("メールアドレスを入力してください")).toBeDefined();
    expect(currentStep()).toContain("基本情報");
  });

  it("fills 就業先番号 with the chosen client's next number on create", async () => {
    const findNextNumber = vi.fn(() => Promise.resolve(8));
    renderForm({ defaultValues: { ...emptyBranchValues(), clientId: CLIENT.id }, findNextNumber });

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^就業先番号/)).toHaveProperty("value", "8");
    });
    expect(findNextNumber).toHaveBeenCalledWith(CLIENT.id);
  });

  it("drops the 地域 the chosen エリア no longer covers", async () => {
    renderForm();
    expect(screen.getByText("4 - 南関東")).toBeDefined();

    fireEvent.click(screen.getByLabelText(/^エリア/));
    choose(await screen.findByRole("option", { name: "西日本" }));

    await vi.waitFor(() => {
      expect(screen.queryByText("4 - 南関東")).toBeNull();
    });
  });

  it("goes to 確認 and sends the input without the address parts the lookup filled", async () => {
    const { onSubmit } = renderForm();

    next();
    expect(await screen.findByText("〒160-0022")).toBeDefined();
    expect(screen.getByText("株式会社テスト")).toBeDefined();
    expect(currentStep()).toContain("確認");
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      clientId: CLIENT.id,
      regionCode: 4,
      address: { postCode: "1600022", address1: "1-2-3" },
      chargerUserIds: [CHARGER.id],
      contactPosition: "LEADER",
    });
    expect(onSubmit.mock.calls[0]?.[0].address).not.toHaveProperty("pref");
  });

  it("moves one step for a double click on 次へ and never saves on its second click", async () => {
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }), { detail: 1 });
    await screen.findByText("〒160-0022");
    // A double click's second click lands on the button the first one relabelled.
    fireEvent.click(screen.getByRole("button", { name: "追加" }), { detail: 2 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(screen.getByRole("button", { name: "キャンセル" }).getAttribute("href")).toBe(
      "/admin/branch",
    );
  });
});

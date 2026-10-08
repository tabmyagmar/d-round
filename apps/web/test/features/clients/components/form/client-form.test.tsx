// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClientFormValues } from "@repo/validation";

import { ClientForm } from "@/features/clients/components/form/client-form";
import type { ClientFormProps } from "@/features/clients/components/form/client-form";
import { emptyClientValues } from "@/features/clients/utils/client-form-input";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

const CHARGER = { id: "019a0000-0000-7000-8000-0000000000c1", name: "佐藤 一郎" };

/** A form whose every field is valid: 東日本, 南関東, one 担当者, 派遣. */
const VALID: ClientFormValues = {
  number: 101,
  name: "株式会社テスト",
  nameKana: "カブシキガイシャテスト",
  areas: ["EAST"],
  regionCodes: [4],
  chargerUserIds: [CHARGER.id],
  address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
  phoneNumber: "03-1234-5678",
  fax: null,
  webUrl: null,
  orderTypes: ["DISPATCH"],
};

const renderForm = (overrides: Partial<ClientFormProps> = {}) => {
  const onSubmit = vi.fn();
  render(
    <StrictMode>
      <ClientForm
        title="クライアント情報登録"
        defaultValues={VALID}
        hierarchy={HIERARCHY}
        chargerOptions={[CHARGER]}
        chargersLoading={false}
        findAddress={() => Promise.resolve({ pref: "東京都", city: "新宿区", town: "新宿" })}
        isNumberFree={() => Promise.resolve(true)}
        cancelHref="/admin/client"
        submitLabel="追加"
        pendingLabel="追加中…"
        pending={false}
        onSubmit={onSubmit}
        {...overrides}
      />
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

describe("ClientForm", () => {
  it("refuses 次へ on an empty form and shows the legacy field errors", async () => {
    renderForm({ defaultValues: emptyClientValues() });

    next();

    expect(await screen.findByText("クライアント名を入力してください")).toBeDefined();
    expect(screen.getByText("クライアント番号は必須です")).toBeDefined();
    expect(screen.getByText("担当者を選択してください")).toBeDefined();
    expect(screen.getByText("受注種別を選択してください")).toBeDefined();
    expect(currentStep()).toContain("基本情報");
  });

  it("formats the phone and FAX numbers as they are typed", () => {
    renderForm({ defaultValues: emptyClientValues() });

    fireEvent.change(screen.getByLabelText(/^電話番号/), { target: { value: "0312345678" } });
    fireEvent.change(screen.getByLabelText(/^FAX/), { target: { value: "0312345679" } });

    expect(screen.getByLabelText(/^電話番号/)).toHaveProperty("value", "03-1234-5678");
    expect(screen.getByLabelText(/^FAX/)).toHaveProperty("value", "03-1234-5679");
  });

  it("keeps the first step when the クライアント番号 is taken, with the legacy message", async () => {
    renderForm({ isNumberFree: () => Promise.resolve(false) });

    next();

    expect(await screen.findByText("このクライアント番号は既に使用されています")).toBeDefined();
    expect(currentStep()).toContain("基本情報");
  });

  it("goes to 確認 and sends the input without the address parts the lookup filled", async () => {
    const { onSubmit } = renderForm();

    next();
    expect(await screen.findByText("〒160-0022")).toBeDefined();
    expect(currentStep()).toContain("確認");
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      number: 101,
      address: { postCode: "1600022", address1: "1-2-3" },
      chargerUserIds: [CHARGER.id],
      orderTypes: ["DISPATCH"],
    });
    expect(onSubmit.mock.calls[0]?.[0].address).not.toHaveProperty("pref");
  });

  it("goes back with 戻る and through the completed step; キャンセル leaves for the list", async () => {
    renderForm();
    next();
    await screen.findByText("〒160-0022");

    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect(currentStep()).toContain("基本情報");
    next();
    await screen.findByText("〒160-0022");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "入力ステップ" })).getByRole("button", {
        name: "基本情報",
      }),
    );
    expect(currentStep()).toContain("基本情報");
    // Base UI's Button rendering a Link keeps role="button" on the <a>.
    expect(screen.getByRole("button", { name: "キャンセル" }).getAttribute("href")).toBe(
      "/admin/client",
    );
  });

  it("moves one step for a double click on 次へ and never saves on its second click", async () => {
    const { onSubmit } = renderForm();
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

    fireEvent.click(screen.getByRole("button", { name: "次へ" }), { detail: 1 });
    await screen.findByText("〒160-0022");
    // A double click's second click lands on the button the first one relabelled.
    fireEvent.click(screen.getByRole("button", { name: "追加" }), { detail: 2 });
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "追加" }), { detail: 1 });
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});

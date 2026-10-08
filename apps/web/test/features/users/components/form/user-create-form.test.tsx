// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { href, routes } from "@/config/routes";
import { UserCreateForm } from "@/features/users/components/form/user-create-form";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

const renderForm = (isEmployeeNumberFree = vi.fn().mockResolvedValue(true)) => {
  const onSubmit = vi.fn();
  render(
    <UserCreateForm
      roleField={{ options: ["admin", "manager", "am"], disabled: false }}
      canEditPermissions
      hierarchy={HIERARCHY}
      isEmployeeNumberFree={isEmployeeNumberFree}
      pending={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

/** Base UI selects an option on pointer up, as a real pointer would. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const fill = (label: RegExp, value: string) => {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
};

const fillName = () => {
  fill(/^姓/, "山田");
  fill(/^名/, "太郎");
  fill(/^セイ/, "ヤマダ");
  fill(/^メイ/, "タロウ");
};

/** 社員番号 12, 部署名, 役職 AM, エリア 東日本 and 地域 南関東 (the popups closed again). */
const fillProfile = async () => {
  fill(/^社員番号/, "12");
  fill(/^部署名/, "東日本営業部");
  fireEvent.click(screen.getByLabelText(/^役職/));
  choose(await screen.findByRole("option", { name: "AM" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));
  const regions = screen.getByLabelText(/^地域/);
  fireEvent.focus(regions);
  fireEvent.keyDown(regions, { key: "ArrowDown" });
  choose(await screen.findByRole("option", { name: "4 - 南関東" }));
  fireEvent.keyDown(regions, { key: "Escape" });
};

const fillEmail = (confirmation = "taro@example.com") => {
  fill(/^メールアドレス$|^メールアドレス\*/, "taro@example.com");
  fill(/メールアドレス（確認）/, confirmation);
};

const PROFILE = {
  employeeNumber: 12,
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: null,
  areas: ["EAST"],
  regionCodes: [4],
};

describe("UserCreateForm", () => {
  it("keeps キャンセル and 招待メールを送信 in the bar at the bottom of the page, outside the card", () => {
    renderForm();

    const send = screen.getByRole("button", { name: "招待メールを送信" });
    const cancel = screen.getByRole("button", { name: "キャンセル" });
    expect(send.closest("[data-slot=sticky-bar]")).not.toBeNull();
    expect(send.closest("[data-slot=card]")).toBeNull();
    expect(cancel.closest("[data-slot=sticky-bar]")).not.toBeNull();
    expect(cancel.getAttribute("href")).toBe(href(routes.user.list));
  });

  it("invites with the name, the profile, the email and AM as the default account type", async () => {
    const isEmployeeNumberFree = vi.fn().mockResolvedValue(true);
    const onSubmit = renderForm(isEmployeeNumberFree);

    fillName();
    await fillProfile();
    fillEmail();
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "taro@example.com",
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        role: "am",
        profile: PROFILE,
      });
    });
    expect(isEmployeeNumberFree).toHaveBeenCalledWith(12);
  });

  it("asks for the profile, as the legacy form did", async () => {
    const onSubmit = renderForm();

    fillName();
    fillEmail();
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("社員番号は必須です")).toBeDefined();
    expect(screen.getByText("部署名を入力してください")).toBeDefined();
    expect(screen.getByText("エリアを選択してください")).toBeDefined();
    expect(screen.getByText("地域を選択してください")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps a 社員番号 another user holds on the field and sends nothing", async () => {
    const onSubmit = renderForm(vi.fn().mockResolvedValue(false));

    fillName();
    await fillProfile();
    fillEmail();
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("この社員番号は既に使用されています")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses an email confirmation that differs", async () => {
    const onSubmit = renderForm();

    fillName();
    // The confirmation is checked once every other field is valid.
    await fillProfile();
    fillEmail("jiro@example.com");
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("メールアドレスが一致していません")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("asks for the readings in full-width katakana", async () => {
    const onSubmit = renderForm();

    fillName();
    fill(/^セイ/, "やまだ");
    fillEmail();
    fireEvent.click(screen.getByRole("button", { name: "招待メールを送信" }));

    expect(await screen.findByText("全角カタカナで入力してください")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's error", () => {
    render(
      <UserCreateForm
        roleField={{ options: ["am"], disabled: false }}
        canEditPermissions={false}
        hierarchy={HIERARCHY}
        isEmployeeNumberFree={vi.fn()}
        pending={false}
        errorMessage="A user with this email already exists"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("A user with this email already exists")).toBeDefined();
  });
});

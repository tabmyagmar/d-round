// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import type { Role } from "@repo/validation";

import { UserFormFields } from "@/features/users/components/form/user-form-fields";
import type { UserFieldValues } from "@/features/users/components/form/user-form-fields";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

type HarnessProps = {
  role: Role;
  options: readonly Role[];
  disabled?: boolean;
  canEditPermissions: boolean;
};

/** The smallest host: a react-hook-form form with the shared user fields. */
const Harness = ({ role, options, disabled = false, canEditPermissions }: HarnessProps) => {
  const form = useForm<UserFieldValues>({
    defaultValues: {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
      role,
    },
  });
  return (
    <UserFormFields
      control={form.control}
      roleField={{ options, disabled }}
      canEditPermissions={canEditPermissions}
      hierarchy={HIERARCHY}
    />
  );
};

describe("UserFormFields", () => {
  it("shows 姓, 名, セイ, メイ and the account type with its legacy label", () => {
    render(<Harness role="manager" options={["manager", "am"]} canEditPermissions={false} />);

    expect(screen.getByLabelText(/^姓/)).toHaveProperty("value", "山田");
    expect(screen.getByLabelText(/^名/)).toHaveProperty("value", "太郎");
    expect(screen.getByLabelText(/^セイ/)).toHaveProperty("value", "ヤマダ");
    expect(screen.getByLabelText(/^メイ/)).toHaveProperty("value", "タロウ");
    expect(screen.getByText("マネジャー")).toBeDefined();
  });

  it("shows the profile fields in the legacy order", () => {
    render(<Harness role="manager" options={["manager", "am"]} canEditPermissions={false} />);

    const labels = [
      "社員番号",
      "姓",
      "セイ",
      "エリア",
      "地域",
      "部署名",
      "役職",
      "アカウントタイプ",
      "退職日",
    ];
    const elements = labels.map((label) =>
      screen.getByText(
        (_, element) =>
          ["LABEL", "LEGEND"].includes(element?.tagName ?? "") &&
          (element?.textContent ?? "").replace("*", "").trim() === label,
      ),
    );
    for (const [index, element] of elements.slice(1).entries()) {
      // DOCUMENT_POSITION_FOLLOWING: each field comes after the previous one.
      expect(elements[index]!.compareDocumentPosition(element) & 4).toBe(4);
    }
  });

  it("offers 権限（詳細設定） for a manager to a caller who may change permissions", () => {
    render(<Harness role="manager" options={["manager", "am"]} canEditPermissions />);

    expect(screen.getByRole("button", { name: /権限（詳細設定）/ })).toBeDefined();
  });

  it("offers no permission settings for other roles or to other callers", () => {
    const { unmount } = render(
      <Harness role="am" options={["manager", "am"]} canEditPermissions />,
    );
    expect(screen.queryByRole("button", { name: /権限（詳細設定）/ })).toBeNull();
    unmount();

    render(<Harness role="manager" options={["manager"]} canEditPermissions={false} />);
    expect(screen.queryByRole("button", { name: /権限（詳細設定）/ })).toBeNull();
  });
});

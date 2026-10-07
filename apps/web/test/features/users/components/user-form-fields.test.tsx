// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import type { Role } from "@repo/validation";

import { UserFormFields } from "@/features/users/components/user-form-fields";
import type { UserFieldValues } from "@/features/users/components/user-form-fields";

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
    />
  );
};

describe("UserFormFields", () => {
  it("shows 姓, 名, セイ, メイ and the account type with its legacy label", () => {
    render(<Harness role="manager" options={["manager", "staff"]} canEditPermissions={false} />);

    expect(screen.getByLabelText(/^姓/)).toHaveProperty("value", "山田");
    expect(screen.getByLabelText(/^名/)).toHaveProperty("value", "太郎");
    expect(screen.getByLabelText(/^セイ/)).toHaveProperty("value", "ヤマダ");
    expect(screen.getByLabelText(/^メイ/)).toHaveProperty("value", "タロウ");
    expect(screen.getByText("マネジャー")).toBeDefined();
  });

  it("offers 権限（詳細設定） for a manager to a caller who may change permissions", () => {
    render(<Harness role="manager" options={["manager", "staff"]} canEditPermissions />);

    expect(screen.getByRole("button", { name: /権限（詳細設定）/ })).toBeDefined();
  });

  it("offers no permission settings for other roles or to other callers", () => {
    const { unmount } = render(
      <Harness role="staff" options={["manager", "staff"]} canEditPermissions />,
    );
    expect(screen.queryByRole("button", { name: /権限（詳細設定）/ })).toBeNull();
    unmount();

    render(<Harness role="manager" options={["manager"]} canEditPermissions={false} />);
    expect(screen.queryByRole("button", { name: /権限（詳細設定）/ })).toBeNull();
  });
});

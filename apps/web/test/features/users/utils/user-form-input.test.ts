import { describe, expect, it } from "vitest";

import { toInviteInput, toUpdateInput } from "@/features/users/utils/user-form-input";

const USER = {
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f",
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: null,
  role: "manager",
  permissionKeys: ["1202", "1302"],
} as const;

const NAMES = {
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
};

describe("toInviteInput", () => {
  it("drops the email confirmation", () => {
    expect(
      toInviteInput({
        email: "a@example.com",
        emailConfirm: "a@example.com",
        ...NAMES,
        role: "am",
      }),
    ).toEqual({ email: "a@example.com", ...NAMES, role: "am" });
  });

  it("sends adjusted permissions for a manager only", () => {
    const base = { email: "a@example.com", emailConfirm: "a@example.com", ...NAMES };

    expect(toInviteInput({ ...base, role: "manager", permissionKeys: ["1101"] })).toMatchObject({
      permissionKeys: ["1101"],
    });
    expect(toInviteInput({ ...base, role: "am", permissionKeys: ["1101"] })).not.toHaveProperty(
      "permissionKeys",
    );
  });
});

describe("toUpdateInput", () => {
  it("sends only what changed", () => {
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        lastName: "山田",
        firstName: "太郎",
        role: "manager",
      }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, { userId: USER.id, ...NAMES, firstName: "花子", role: "am" }),
    ).toEqual({ userId: USER.id, firstName: "花子", firstNameKana: "タロウ", role: "am" });
  });

  it("sends the permissions of a manager when they differ from the current ones", () => {
    expect(
      toUpdateInput(USER, { userId: USER.id, role: "manager", permissionKeys: ["1302", "1202"] }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, { userId: USER.id, role: "manager", permissionKeys: ["1202", "1101"] }),
    ).toEqual({ userId: USER.id, permissionKeys: ["1202", "1101"] });
  });

  it("does not send permissions for a role without overrides", () => {
    expect(toUpdateInput(USER, { userId: USER.id, role: "am", permissionKeys: ["1101"] })).toEqual({
      userId: USER.id,
      role: "am",
    });
  });
});

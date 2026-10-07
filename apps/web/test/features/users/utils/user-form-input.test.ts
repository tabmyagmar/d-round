import { describe, expect, it } from "vitest";

import { toInviteInput, toUpdateInput } from "@/features/users/utils/user-form-input";

const USER = {
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f",
  name: "山田 太郎",
  role: "manager",
  permissionKeys: ["1202", "1302"],
} as const;

describe("toInviteInput", () => {
  it("drops the email confirmation", () => {
    expect(
      toInviteInput({
        email: "a@example.com",
        emailConfirm: "a@example.com",
        name: "A",
        role: "staff",
      }),
    ).toEqual({ email: "a@example.com", name: "A", role: "staff" });
  });

  it("sends adjusted permissions for a manager only", () => {
    const base = { email: "a@example.com", emailConfirm: "a@example.com", name: "A" };

    expect(toInviteInput({ ...base, role: "manager", permissionKeys: ["1101"] })).toMatchObject({
      permissionKeys: ["1101"],
    });
    expect(toInviteInput({ ...base, role: "staff", permissionKeys: ["1101"] })).not.toHaveProperty(
      "permissionKeys",
    );
  });
});

describe("toUpdateInput", () => {
  it("sends only what changed", () => {
    expect(toUpdateInput(USER, { userId: USER.id, name: USER.name, role: "manager" })).toEqual({
      userId: USER.id,
    });
    expect(toUpdateInput(USER, { userId: USER.id, name: "山田 花子", role: "staff" })).toEqual({
      userId: USER.id,
      name: "山田 花子",
      role: "staff",
    });
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
    expect(
      toUpdateInput(USER, { userId: USER.id, role: "staff", permissionKeys: ["1101"] }),
    ).toEqual({ userId: USER.id, role: "staff" });
  });
});

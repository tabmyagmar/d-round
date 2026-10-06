import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  inviteUserSchema,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
} from "../src/user.schema";

/** The first issue's path and message, or null when the value parses. */
const firstIssue = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => {
  const issue = result.error?.issues[0];
  return issue ? { path: issue.path.join("."), message: issue.message } : null;
};

describe("passwordSchema (the password policy)", () => {
  it("accepts 8 characters with a letter and a digit", () => {
    expect(passwordSchema.safeParse("Abcd1234").success).toBe(true);
  });

  it("accepts the 128-character maximum", () => {
    expect(passwordSchema.safeParse(`a1${"x".repeat(126)}`).success).toBe(true);
  });

  it.each([
    ["Abc1234", "パスワードは8文字以上で入力してください"],
    [`a1${"x".repeat(127)}`, "パスワードは128文字以内で入力してください"],
    ["12345678", "英字を1文字以上含めてください"],
    ["abcdefgh", "数字を1文字以上含めてください"],
  ])("rejects %j with %s", (value, message) => {
    expect(firstIssue(passwordSchema.safeParse(value))?.message).toBe(message);
  });
});

describe("emailSchema", () => {
  it("asks for an address when empty and for a valid one when malformed", () => {
    expect(firstIssue(emailSchema.safeParse(""))?.message).toBe("メールアドレスを入力してください");
    expect(firstIssue(emailSchema.safeParse("taro@"))?.message).toBe(
      "メールアドレスの形式が正しくありません",
    );
  });
});

describe("signInSchema", () => {
  it("does not apply the password policy, so a policy change never locks anyone out", () => {
    const result = signInSchema.safeParse({
      email: "taro@example.com",
      password: "short",
      rememberMe: false,
    });
    expect(result.success).toBe(true);
  });

  it("requires a password and the rememberMe choice", () => {
    const result = signInSchema.safeParse({ email: "taro@example.com", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["password", "rememberMe"]),
    );
  });
});

describe("forgotPasswordSchema", () => {
  it("needs only a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "taro@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords that follow the policy", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "Abcd1234",
      confirmPassword: "Abcd1234",
    });
    expect(result.success).toBe(true);
  });

  it("reports a mismatch on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "Abcd1234",
      confirmPassword: "Abcd12345",
    });
    expect(firstIssue(result)).toEqual({
      path: "confirmPassword",
      message: "パスワードが一致しません",
    });
  });

  it("applies the policy to the new password", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "12345678",
      confirmPassword: "12345678",
    });
    expect(firstIssue(result)?.path).toBe("newPassword");
  });
});

describe("changePasswordSchema", () => {
  it("accepts a different new password, confirmed", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Old12345",
      newPassword: "New12345",
      confirmPassword: "New12345",
    });
    expect(result.success).toBe(true);
  });

  it("refuses to reuse the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Same1234",
      newPassword: "Same1234",
      confirmPassword: "Same1234",
    });
    expect(firstIssue(result)).toEqual({
      path: "newPassword",
      message: "現在のパスワードと異なるパスワードを入力してください",
    });
  });

  it("reports a mismatch on confirmPassword", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Old12345",
      newPassword: "New12345",
      confirmPassword: "New54321",
    });
    expect(firstIssue(result)?.path).toBe("confirmPassword");
  });

  it("requires the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "New12345",
      confirmPassword: "New12345",
    });
    expect(firstIssue(result)).toEqual({
      path: "currentPassword",
      message: "現在のパスワードを入力してください",
    });
  });
});

describe("inviteUserSchema", () => {
  it("accepts an email, a name and a catalog role", () => {
    const result = inviteUserSchema.safeParse({
      email: "hanako@example.com",
      name: "山田 花子",
      role: "staff",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a role outside the catalog and a malformed email", () => {
    const result = inviteUserSchema.safeParse({ email: "hanako", name: "花子", role: "owner" });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["email", "role"]),
    );
  });
});

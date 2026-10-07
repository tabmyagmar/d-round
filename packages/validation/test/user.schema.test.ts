import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  fullName,
  inviteUserFormSchema,
  kanaSchema,
  inviteUserSchema,
  listUsersSchema,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
  updateUserSchema,
  userNameSchema,
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

  it("caps the password at 128 characters with a Japanese message", () => {
    const result = signInSchema.safeParse({
      email: "taro@example.com",
      password: "a".repeat(129),
      rememberMe: false,
    });
    expect(firstIssue(result)).toEqual({
      path: "password",
      message: "パスワードは128文字以内で入力してください",
    });
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
      message: "パスワードが一致していません",
    });
  });

  it("asks for the confirmation when it is empty", () => {
    const result = resetPasswordSchema.safeParse({ newPassword: "Abcd1234", confirmPassword: "" });
    expect(firstIssue(result)).toEqual({
      path: "confirmPassword",
      message: "パスワードを再度入力してください",
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

describe("listUsersSchema", () => {
  it("lists active users newest first by default", () => {
    expect(listUsersSchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      status: "active",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("accepts the deactivated status and an allow-listed sort column", () => {
    const parsed = listUsersSchema.parse({
      status: "deactivated",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(parsed).toMatchObject({ status: "deactivated", sortBy: "name", sortOrder: "asc" });
  });

  it("rejects a sort column outside the allow-list, an unknown status and an unknown direction", () => {
    expect(listUsersSchema.safeParse({ sortBy: "role" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ status: "banned" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ sortOrder: "up" }).success).toBe(false);
  });
});

describe("assignableRoles (who may give which role)", () => {
  it("lets both admin roles assign admin, manager and staff, never super_admin", () => {
    expect(assignableRoles("super_admin")).toEqual(["admin", "manager", "staff"]);
    expect(assignableRoles("admin")).toEqual(["admin", "manager", "staff"]);
  });

  it("lets a manager assign manager and staff only", () => {
    expect(assignableRoles("manager")).toEqual(["manager", "staff"]);
  });

  it("lets staff assign nothing", () => {
    expect(assignableRoles("staff")).toEqual([]);
  });
});

describe("inviteUserFormSchema", () => {
  const valid = {
    email: "new@example.com",
    emailConfirm: "new@example.com",
    name: "新規",
    role: "staff",
  };

  it("accepts a confirmed email", () => {
    expect(inviteUserFormSchema.safeParse(valid).success).toBe(true);
  });

  it("reports a confirmation that differs on emailConfirm", () => {
    expect(
      firstIssue(inviteUserFormSchema.safeParse({ ...valid, emailConfirm: "old@example.com" })),
    ).toEqual({ path: "emailConfirm", message: "メールアドレスが一致していません" });
  });
});

describe("updateUserSchema", () => {
  const userId = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

  it("accepts any subset of name, role and permission keys", () => {
    expect(updateUserSchema.safeParse({ userId }).success).toBe(true);
    expect(
      updateUserSchema.safeParse({ userId, name: "A", role: "manager", permissionKeys: ["1101"] })
        .success,
    ).toBe(true);
  });

  it("rejects an empty permission key and a role outside the catalog", () => {
    expect(updateUserSchema.safeParse({ userId, permissionKeys: [""] }).success).toBe(false);
    expect(updateUserSchema.safeParse({ userId, role: "owner" }).success).toBe(false);
  });
});

describe("kanaSchema (セイ / メイ)", () => {
  const sei = kanaSchema("セイ");

  it("accepts full-width katakana with ー, ・ and spaces", () => {
    for (const value of ["ヤマダ", "ヤマダ タロウ", "ジョン・スミス", "ヴィー", "ヤマダ　タロウ"]) {
      expect(sei.safeParse(value).success).toBe(true);
    }
  });

  it("refuses hiragana, half-width katakana, latin letters and kanji", () => {
    for (const value of ["やまだ", "ﾔﾏﾀﾞ", "Yamada", "山田"]) {
      expect(firstIssue(sei.safeParse(value))?.message).toBe("全角カタカナで入力してください");
    }
  });

  it("asks for the reading when it is empty or blank", () => {
    expect(firstIssue(sei.safeParse(""))?.message).toBe("セイを入力してください");
    expect(firstIssue(sei.safeParse("  "))?.message).toBe("セイを入力してください");
  });
});

describe("userNameSchema", () => {
  const valid = {
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
  };

  it("takes 姓, 名 and their readings, trimmed", () => {
    expect(userNameSchema.parse({ ...valid, lastName: " 山田 " })).toEqual(valid);
  });

  it("names the missing part", () => {
    expect(firstIssue(userNameSchema.safeParse({ ...valid, firstName: "" }))).toEqual({
      path: "firstName",
      message: "名を入力してください",
    });
    expect(firstIssue(userNameSchema.safeParse({ ...valid, firstNameKana: "たろう" }))).toEqual({
      path: "firstNameKana",
      message: "全角カタカナで入力してください",
    });
  });

  it("caps each part at 80 characters", () => {
    expect(userNameSchema.safeParse({ ...valid, lastName: "山".repeat(81) }).success).toBe(false);
  });
});

describe("fullName", () => {
  it("is 姓 and 名 with a space, the display name Better Auth keeps", () => {
    expect(fullName({ lastName: "山田", firstName: "太郎" })).toBe("山田 太郎");
  });
});

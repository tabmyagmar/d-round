import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  changePasswordSchema,
  chargerOptionsSchema,
  emailSchema,
  employeeNumberOfSearch,
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
  userProfileSchema,
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
  it("accepts an email, 姓 / 名 with their readings, a catalog role and the profile", () => {
    const result = inviteUserSchema.safeParse({
      email: "hanako@example.com",
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
      role: "am",
      profile: {
        employeeNumber: 3,
        departmentName: "本社",
        position: "SV",
        retirementDate: null,
        areas: ["EAST"],
        regionCodes: [4],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a role outside the catalog and a malformed email", () => {
    const result = inviteUserSchema.safeParse({
      email: "hanako",
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
      role: "owner",
    });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["email", "role"]),
    );
  });
});

describe("userProfileSchema (担当者 HR fields)", () => {
  const profile = {
    employeeNumber: 12,
    departmentName: " 東日本営業部 ",
    position: "SV",
    retirementDate: null,
    areas: ["WEST", "EAST", "EAST"],
    regionCodes: [7, 4, 4],
  };

  it("takes the fields, trims the department, orders areas and dedupes the region codes", () => {
    expect(userProfileSchema.parse(profile)).toEqual({
      employeeNumber: 12,
      departmentName: "東日本営業部",
      position: "SV",
      retirementDate: null,
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
    });
    expect(
      userProfileSchema.parse({ ...profile, retirementDate: "2027-03-31" }).retirementDate,
    ).toBe("2027-03-31");
  });

  it.each([
    [{ employeeNumber: null }, "employeeNumber", "社員番号は必須です"],
    [{ employeeNumber: 0 }, "employeeNumber", "社員番号は正の整数で入力してください"],
    [{ employeeNumber: 1.5 }, "employeeNumber", "社員番号は正の整数で入力してください"],
    [{ employeeNumber: 1_000_000_000 }, "employeeNumber", "社員番号は9桁以内で入力してください"],
    [{ departmentName: " " }, "departmentName", "部署名を入力してください"],
    [{ position: undefined }, "position", "役職を選択してください"],
    [{ retirementDate: "2027/03/31" }, "retirementDate", "日付の形式が正しくありません"],
    [{ areas: [] }, "areas", "エリアを選択してください"],
    [{ regionCodes: [] }, "regionCodes", "地域を選択してください"],
  ])("refuses %j with the legacy message", (change, path, message) => {
    expect(firstIssue(userProfileSchema.safeParse({ ...profile, ...change }))).toEqual({
      path,
      message,
    });
  });

  it("is required on invite and optional on update", () => {
    const invite = {
      email: "hanako@example.com",
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "ヤマダ",
      firstNameKana: "ハナコ",
      role: "am",
    };
    expect(inviteUserSchema.parse({ ...invite, profile }).profile.regionCodes).toEqual([4, 7]);
    expect(firstIssue(inviteUserSchema.safeParse(invite))?.path).toBe("profile");
    expect(updateUserSchema.parse({ userId: crypto.randomUUID(), profile }).profile?.areas).toEqual(
      ["EAST", "WEST"],
    );
  });
});

describe("chargerOptionsSchema", () => {
  it("needs at least one region code", () => {
    expect(chargerOptionsSchema.parse({ regionCodes: [4, 3, 4] })).toEqual({ regionCodes: [3, 4] });
    expect(chargerOptionsSchema.safeParse({ regionCodes: ["4"] }).success).toBe(false);
    expect(firstIssue(chargerOptionsSchema.safeParse({ regionCodes: [] }))).toEqual({
      path: "regionCodes",
      message: "地域を選択してください",
    });
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

  it("filters by areas, region codes and positions, and sorts by 社員番号", () => {
    expect(
      listUsersSchema.parse({
        areas: ["EAST"],
        regionCodes: ["4", "7"],
        positions: ["SV", "LEADER"],
        sortBy: "employeeNumber",
      }),
    ).toMatchObject({
      areas: ["EAST"],
      regionCodes: [4, 7],
      positions: ["SV", "LEADER"],
      sortBy: "employeeNumber",
    });
    expect(listUsersSchema.safeParse({ areas: ["NORTH"] }).success).toBe(false);
    expect(listUsersSchema.safeParse({ positions: ["CEO"] }).success).toBe(false);
  });

  it("rejects a sort column outside the allow-list, an unknown status and an unknown direction", () => {
    expect(listUsersSchema.safeParse({ sortBy: "role" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ status: "banned" }).success).toBe(false);
    expect(listUsersSchema.safeParse({ sortOrder: "up" }).success).toBe(false);
  });
});

describe("assignableRoles (who may give which role)", () => {
  it("lets both admin roles assign admin, manager and AM, never super_admin", () => {
    expect(assignableRoles("super_admin")).toEqual(["admin", "manager", "am"]);
    expect(assignableRoles("admin")).toEqual(["admin", "manager", "am"]);
  });

  it("lets a manager assign manager and AM only", () => {
    expect(assignableRoles("manager")).toEqual(["manager", "am"]);
  });

  it("lets an AM assign nothing", () => {
    expect(assignableRoles("am")).toEqual([]);
  });
});

describe("inviteUserFormSchema", () => {
  const valid = {
    email: "new@example.com",
    emailConfirm: "new@example.com",
    lastName: "新規",
    firstName: "太郎",
    lastNameKana: "シンキ",
    firstNameKana: "タロウ",
    role: "am",
    profile: {
      employeeNumber: 7,
      departmentName: "本社",
      position: "SV",
      retirementDate: null,
      areas: ["EAST"],
      regionCodes: [4],
    },
  };

  it("accepts a confirmed email", () => {
    expect(inviteUserFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the profile, as the legacy form did", () => {
    const { profile: _profile, ...withoutProfile } = valid;
    expect(firstIssue(inviteUserFormSchema.safeParse(withoutProfile))?.path).toBe("profile");
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
      updateUserSchema.safeParse({
        userId,
        firstName: "太郎",
        firstNameKana: "タロウ",
        role: "manager",
        permissionKeys: ["1101"],
      }).success,
    ).toBe(true);
  });

  it("rejects a reading that is not katakana", () => {
    expect(updateUserSchema.safeParse({ userId, lastNameKana: "やまだ" }).success).toBe(false);
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

describe("employeeNumberOfSearch", () => {
  it("reads one to nine digits as the employee number a list search also matches", () => {
    expect(employeeNumberOfSearch("0042")).toBe(42);
    expect(employeeNumberOfSearch("999999999")).toBe(999_999_999);
  });

  it("reads no number from zero, ten digits or text", () => {
    for (const search of ["0", "000", "1234567890", "12a", "山田"]) {
      expect(employeeNumberOfSearch(search)).toBeNull();
    }
  });
});

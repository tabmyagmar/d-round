import { describe, expect, it } from "vitest";

import { ROLES, USER_STATUSES } from "@repo/validation";

import {
  readingOf,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  userStatusOf,
} from "@/features/users/utils/user-labels";

describe("user labels", () => {
  it("names every role and status with the legacy Japanese labels", () => {
    expect(ROLES.map((role) => ROLE_LABELS[role])).toEqual([
      "スーパーアドミン",
      "アドミン",
      "マネジャー",
      "AM",
    ]);
    expect(USER_STATUSES.map((status) => USER_STATUS_LABELS[status])).toEqual(["利用中", "停止"]);
  });

  it("reads a user without deletedAt as active and one with it as deactivated", () => {
    expect(userStatusOf({ deletedAt: null })).toBe("active");
    expect(userStatusOf({ deletedAt: new Date() })).toBe("deactivated");
  });

  it("joins the readings, or has none for a user from before the name parts", () => {
    expect(readingOf({ lastNameKana: "ヤマダ", firstNameKana: "タロウ" })).toBe("ヤマダ タロウ");
    expect(readingOf({ lastNameKana: null, firstNameKana: null })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import type { UserProfileInput } from "@repo/validation";

import {
  EMPTY_PROFILE,
  profileFormValuesOf,
  toInviteInput,
  toUpdateInput,
} from "@/features/users/utils/user-form-input";
import type { StoredProfile } from "@/features/users/utils/user-form-input";

/** The stored profile as `user.byId` returns it; 退職日 is a DATE at UTC midnight. */
const STORED_PROFILE: StoredProfile = {
  employeeNumber: 12,
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: new Date("2027-03-31T00:00:00Z"),
  areas: ["EAST"],
  regions: [{ regionCode: 3 }, { regionCode: 4 }],
};

/** The same profile as the form submits it. */
const PROFILE: UserProfileInput = {
  employeeNumber: 12,
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: "2027-03-31",
  areas: ["EAST"],
  regionCodes: [3, 4],
};

const USER = {
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6f",
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: null,
  role: "manager",
  permissionKeys: ["1202", "1302"],
  profile: STORED_PROFILE,
} as const;

const NAMES = {
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
};

describe("profileFormValuesOf", () => {
  it("reads the stored profile as form values, 退職日 as its date", () => {
    expect(profileFormValuesOf(STORED_PROFILE)).toEqual(PROFILE);
  });

  it("leaves the fields empty for a user from before profiles", () => {
    expect(profileFormValuesOf(null)).toEqual(EMPTY_PROFILE);
  });
});

describe("toInviteInput", () => {
  it("drops the email confirmation and keeps the profile", () => {
    expect(
      toInviteInput({
        email: "a@example.com",
        emailConfirm: "a@example.com",
        ...NAMES,
        role: "am",
        profile: PROFILE,
      }),
    ).toEqual({ email: "a@example.com", ...NAMES, role: "am", profile: PROFILE });
  });

  it("sends adjusted permissions for a manager only", () => {
    const base = {
      email: "a@example.com",
      emailConfirm: "a@example.com",
      ...NAMES,
      profile: PROFILE,
    };

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
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        ...NAMES,
        firstName: "花子",
        role: "am",
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id, firstName: "花子", firstNameKana: "タロウ", role: "am" });
  });

  it("sends the whole profile when any of it changed", () => {
    const changed = { ...PROFILE, regionCodes: [4] };

    expect(toUpdateInput(USER, { userId: USER.id, profile: changed })).toEqual({
      userId: USER.id,
      profile: changed,
    });
    expect(
      toUpdateInput(
        { ...USER, profile: null },
        { userId: USER.id, ...NAMES, firstNameKana: "", profile: PROFILE },
      ),
    ).toEqual({ userId: USER.id, profile: PROFILE });
  });

  it("sends the permissions of a manager when they differ from the current ones", () => {
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        role: "manager",
        permissionKeys: ["1302", "1202"],
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        role: "manager",
        permissionKeys: ["1202", "1101"],
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id, permissionKeys: ["1202", "1101"] });
  });

  it("does not send permissions for a role without overrides", () => {
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        role: "am",
        permissionKeys: ["1101"],
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id, role: "am" });
  });
});

import { describe, expect, it } from "vitest";

import type { UserProfileInput } from "@repo/validation";

import {
  EMPTY_PROFILE,
  profileFormValuesOf,
  toInviteInput,
  toProfileInput,
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
  avatar: null,
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
        avatar: null,
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
      avatar: null,
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
        avatar: null,
        lastName: "山田",
        firstName: "太郎",
        role: "manager",
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        avatar: null,
        ...NAMES,
        firstName: "花子",
        role: "am",
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id, firstName: "花子", firstNameKana: "タロウ", role: "am" });
  });

  it("sends the whole profile when any of it changed", () => {
    const changed = { ...PROFILE, regionCodes: [4] };

    expect(toUpdateInput(USER, { userId: USER.id, avatar: null, profile: changed })).toEqual({
      userId: USER.id,
      profile: changed,
    });
    expect(
      toUpdateInput(
        { ...USER, profile: null },
        { userId: USER.id, avatar: null, ...NAMES, firstNameKana: "", profile: PROFILE },
      ),
    ).toEqual({ userId: USER.id, profile: PROFILE });
  });

  it("sends the permissions of a manager when they differ from the current ones", () => {
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        avatar: null,
        role: "manager",
        permissionKeys: ["1302", "1202"],
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id });
    expect(
      toUpdateInput(USER, {
        userId: USER.id,
        avatar: null,
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
        avatar: null,
        role: "am",
        permissionKeys: ["1101"],
        profile: PROFILE,
      }),
    ).toEqual({ userId: USER.id, role: "am" });
  });
});

describe("toProfileInput", () => {
  const NAMES = {
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
  };
  const AVATAR = {
    id: "0199a1b2-0000-7000-8000-000000000001",
    name: "face.png",
    size: 10,
    type: "image/png",
  };

  it("sends the names and leaves the avatar out while it is the stored one", () => {
    expect(toProfileInput({ ...NAMES, avatar: AVATAR }, AVATAR.id)).toEqual(NAMES);
    expect(toProfileInput({ ...NAMES, avatar: null }, null)).toEqual(NAMES);
  });

  it("sends a new avatar's id, and null when the avatar was removed", () => {
    expect(toProfileInput({ ...NAMES, avatar: AVATAR }, null)).toEqual({
      ...NAMES,
      avatarId: AVATAR.id,
    });
    expect(toProfileInput({ ...NAMES, avatar: null }, AVATAR.id)).toEqual({
      ...NAMES,
      avatarId: null,
    });
  });
});

describe("the プロフィール画像 in the user forms' input", () => {
  const AVATAR = {
    id: "0199a1b2-0000-7000-8000-000000000001",
    name: "face.png",
    size: 10,
    type: "image/png",
  };

  it("sends the picked image's id on invite, nothing without one", () => {
    const values = {
      email: "a@example.com",
      emailConfirm: "a@example.com",
      ...NAMES,
      role: "am" as const,
      profile: PROFILE,
    };

    expect(toInviteInput({ ...values, avatar: AVATAR }).avatarId).toBe(AVATAR.id);
    expect(toInviteInput({ ...values, avatar: null })).not.toHaveProperty("avatarId");
  });

  it("sends avatarId on update only when the image changed, null when it was removed", () => {
    const stored = { ...USER, avatar: { id: AVATAR.id } };
    const values = {
      userId: USER.id,
      ...NAMES,
      firstNameKana: "",
      role: "manager" as const,
      profile: PROFILE,
    };

    expect(toUpdateInput(stored, { ...values, avatar: AVATAR })).not.toHaveProperty("avatarId");
    expect(toUpdateInput(stored, { ...values, avatar: null })).toMatchObject({ avatarId: null });
    expect(toUpdateInput(USER, { ...values, avatar: AVATAR })).toMatchObject({
      avatarId: AVATAR.id,
    });
  });
});

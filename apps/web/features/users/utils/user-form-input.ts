import { isOverridableRole } from "@repo/validation";
import type {
  InviteUserFormInput,
  InviteUserInput,
  Position,
  Role,
  SourceArea,
  UpdateUserFormInput,
  UpdateUserInput,
  UserProfileInput,
} from "@repo/validation";

/** 姓, 名, セイ, メイ — the name parts every user form edits. */
export const NAME_PARTS = ["lastName", "firstName", "lastNameKana", "firstNameKana"] as const;
export type NamePart = (typeof NAME_PARTS)[number];

/** A stored 担当者 profile as `user.byId` returns it, or `null` for a user from before profiles. */
export type StoredProfile = {
  employeeNumber: number;
  departmentName: string;
  position: Position;
  retirementDate: Date | null;
  areas: SourceArea[];
  regions: readonly { regionCode: number }[];
} | null;

/** The profile fields as the forms edit them; a missing profile leaves them for the user. */
export type ProfileFormValues = Partial<UserProfileInput>;

export const EMPTY_PROFILE: ProfileFormValues = {
  departmentName: "",
  retirementDate: null,
  areas: [],
  regionCodes: [],
};

/** The stored profile as form values: 退職日 as the DATE's `yyyy-MM-dd` (it is UTC midnight). */
export const profileFormValuesOf = (profile: StoredProfile): ProfileFormValues =>
  profile
    ? {
        employeeNumber: profile.employeeNumber,
        departmentName: profile.departmentName,
        position: profile.position,
        retirementDate: profile.retirementDate?.toISOString().slice(0, 10) ?? null,
        areas: profile.areas,
        regionCodes: profile.regions.map((region) => region.regionCode),
      }
    : EMPTY_PROFILE;

const sameList = (a: readonly unknown[] = [], b: readonly unknown[] = []): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** Whether the submitted profile equals the stored one (lists come sorted from the schema). */
const sameProfile = (stored: ProfileFormValues, submitted: UserProfileInput): boolean =>
  stored.employeeNumber === submitted.employeeNumber &&
  stored.departmentName === submitted.departmentName &&
  stored.position === submitted.position &&
  stored.retirementDate === submitted.retirementDate &&
  sameList(stored.areas, submitted.areas) &&
  sameList(stored.regionCodes, submitted.regionCodes);

/** The invite form's values as `user.invite` input: no confirmation, overrides for a manager. */
export const toInviteInput = (values: InviteUserFormInput): InviteUserInput => ({
  email: values.email,
  lastName: values.lastName,
  firstName: values.firstName,
  lastNameKana: values.lastNameKana,
  firstNameKana: values.firstNameKana,
  role: values.role,
  profile: values.profile,
  ...(values.permissionKeys !== undefined && isOverridableRole(values.role)
    ? { permissionKeys: values.permissionKeys }
    : {}),
});

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

export type StoredUser = {
  id: string;
  role: Role;
  permissionKeys: readonly string[];
  profile: StoredProfile;
} & Record<NamePart, string | null>;

/**
 * The edit form's values as `user.update` input, holding only what differs from `user`: the API
 * then checks only what is being changed (a role or permission change needs `changeRole`, a
 * profile change the `update User` grant) and rewrites the display name "姓 名" when a part
 * changes. The profile goes whole, and only when any of it changed.
 */
export const toUpdateInput = (user: StoredUser, values: UpdateUserFormInput): UpdateUserInput => {
  const role = values.role ?? user.role;
  const keys = values.permissionKeys;
  const parts: Partial<Record<NamePart, string>> = {};
  for (const part of NAME_PARTS) {
    const value = values[part];
    if (value !== undefined && value !== (user[part] ?? "")) {
      parts[part] = value;
    }
  }
  return {
    userId: user.id,
    ...parts,
    ...(role === user.role ? {} : { role }),
    ...(keys !== undefined &&
    isOverridableRole(role) &&
    !(role === user.role && sameKeys(keys, user.permissionKeys))
      ? { permissionKeys: keys }
      : {}),
    ...(sameProfile(profileFormValuesOf(user.profile), values.profile)
      ? {}
      : { profile: values.profile }),
  };
};

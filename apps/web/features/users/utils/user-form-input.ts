import { isOverridableRole } from "@repo/validation";
import type { InviteUserFormInput, InviteUserInput, Role, UpdateUserInput } from "@repo/validation";

/** 姓, 名, セイ, メイ — the name parts every user form edits. */
export const NAME_PARTS = ["lastName", "firstName", "lastNameKana", "firstNameKana"] as const;
export type NamePart = (typeof NAME_PARTS)[number];

/** The invite form's values as `user.invite` input: no confirmation, overrides for a manager. */
export const toInviteInput = (values: InviteUserFormInput): InviteUserInput => ({
  email: values.email,
  lastName: values.lastName,
  firstName: values.firstName,
  lastNameKana: values.lastNameKana,
  firstNameKana: values.firstNameKana,
  role: values.role,
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
} & Record<NamePart, string | null>;

/**
 * The edit form's values as `user.update` input, holding only what differs from `user`: the API
 * then checks only what is being changed (a role or permission change needs `changeRole`) and
 * rewrites the display name "姓 名" when a part changes.
 */
export const toUpdateInput = (user: StoredUser, values: UpdateUserInput): UpdateUserInput => {
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
  };
};

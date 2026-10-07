import { isOverridableRole } from "@repo/validation";
import type { InviteUserFormInput, InviteUserInput, Role, UpdateUserInput } from "@repo/validation";

/** The invite form's values as `user.invite` input: no confirmation, overrides for a manager. */
export const toInviteInput = (values: InviteUserFormInput): InviteUserInput => ({
  email: values.email,
  name: values.name,
  role: values.role,
  ...(values.permissionKeys !== undefined && isOverridableRole(values.role)
    ? { permissionKeys: values.permissionKeys }
    : {}),
});

const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * The edit form's values as `user.update` input, holding only what differs from `user`: the API
 * then checks only what is being changed (a role or permission change needs `changeRole`).
 */
export const toUpdateInput = (
  user: { id: string; name: string; role: Role; permissionKeys: readonly string[] },
  values: UpdateUserInput,
): UpdateUserInput => {
  const role = values.role ?? user.role;
  const keys = values.permissionKeys;
  return {
    userId: user.id,
    ...(values.name !== undefined && values.name !== user.name ? { name: values.name } : {}),
    ...(role === user.role ? {} : { role }),
    ...(keys !== undefined &&
    isOverridableRole(role) &&
    !(role === user.role && sameKeys(keys, user.permissionKeys))
      ? { permissionKeys: keys }
      : {}),
  };
};

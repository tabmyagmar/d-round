import { assignableRoles } from "@repo/validation";
import type { Role } from "@repo/validation";

export type RoleFieldState = { options: readonly Role[]; disabled: boolean };

/**
 * The アカウントタイプ field for the caller (the API enforces the same rule). Inviting: the roles
 * the caller may assign. Editing (`currentRole` given): those roles when the caller holds
 * `changeRole` and may assign the user's current role; otherwise the current role, read-only.
 */
export const roleFieldState = ({
  callerRole,
  canChangeRole,
  currentRole,
}: {
  callerRole: Role;
  canChangeRole: boolean;
  currentRole?: Role;
}): RoleFieldState => {
  const assignable = assignableRoles(callerRole);
  if (currentRole === undefined) {
    return { options: assignable, disabled: assignable.length === 0 };
  }
  return canChangeRole && assignable.includes(currentRole)
    ? { options: assignable, disabled: false }
    : { options: [currentRole], disabled: true };
};

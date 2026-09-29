import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

import type { Role } from "@repo/validation";

/**
 * Better Auth admin-plugin access control. It only governs the admin plugin's own endpoints
 * (list users, set role, ban, revoke sessions...). Business permissions live in CASL
 * (`@repo/permissions`) and stateful rules in services — never here.
 */
export const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({ ...adminAc.statements }),
  member: ac.newRole({ ...userAc.statements }),
} satisfies Record<Role, unknown>;

/** Roles allowed to call privileged admin-plugin endpoints. */
export const ADMIN_ROLES: Role[] = ["admin"];

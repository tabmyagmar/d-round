import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

import type { Role } from "@repo/validation";

export { ADMIN_ROLES } from "@repo/validation";

/**
 * Better Auth admin-plugin access control. It only governs the admin plugin's own endpoints
 * (list users, set role, ban, revoke sessions...). Business permissions live in CASL
 * (`@repo/permissions`) and stateful rules in services — never here.
 */
export const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

export const roles = {
  super_admin: ac.newRole({ ...adminAc.statements }),
  admin: ac.newRole({ ...adminAc.statements }),
  manager: ac.newRole({ ...userAc.statements }),
  staff: ac.newRole({ ...userAc.statements }),
} satisfies Record<Role, unknown>;

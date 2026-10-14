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

/**
 * The admin plugin's admin grants without `impersonate`: an impersonated session puts the target's
 * name on the admin's writes, so the audit log could not tell who acted (docs/adr/0015-audit-log.md).
 */
const adminStatements = {
  ...adminAc.statements,
  user: adminAc.statements.user.filter((action) => action !== "impersonate"),
};

export const roles = {
  super_admin: ac.newRole(adminStatements),
  admin: ac.newRole(adminStatements),
  manager: ac.newRole({ ...userAc.statements }),
  am: ac.newRole({ ...userAc.statements }),
} satisfies Record<Role, unknown>;

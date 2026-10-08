import { ACTIONS, defineAbilityFor, SUBJECT_NAMES } from "@repo/permissions";
import type { AbilityUser, AppAbility, PermissionGrant } from "@repo/permissions";

/** The signed-in user of the access tests; the self rule matches this id. */
export const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";

/** A signed-in user holding exactly these grants; the role never decides. */
export const userWith = (permissions: readonly PermissionGrant[]): AbilityUser => ({
  id: ME_ID,
  role: "am",
  permissions,
});

/** The ability of that user. */
export const abilityWith = (permissions: readonly PermissionGrant[]): AppAbility =>
  defineAbilityFor(userWith(permissions));

/** What `permissions.csv` grants the seeded AM role today. */
export const AM_GRANTS: readonly PermissionGrant[] = [
  { action: "read", subject: "Client" },
  { action: "read", subject: "Staff" },
  { action: "read", subject: "Branch" },
  { action: "create", subject: "Workflow" },
  { action: "read", subject: "Workflow" },
  { action: "update", subject: "Workflow" },
  { action: "delete", subject: "Workflow" },
  { action: "status", subject: "Workflow" },
];

/** Every action on every subject; a user DENY row is this list minus one grant. */
export const EVERY_GRANT: readonly PermissionGrant[] = ACTIONS.flatMap((action) =>
  SUBJECT_NAMES.map((subject) => ({ action, subject })),
);

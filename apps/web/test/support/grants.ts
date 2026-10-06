import { ACTIONS, SUBJECT_NAMES } from "@repo/permissions";
import type { PermissionGrant } from "@repo/permissions";

/** What `permissions.csv` grants the seeded staff role today. */
export const STAFF_GRANTS: readonly PermissionGrant[] = [
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

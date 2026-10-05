import type { Role } from "@repo/validation";

/**
 * THE permission rules — defined once, built twice: `defineAbilityFor` (browser, mongo
 * conditions) and `definePrismaAbilityFor` (API, Prisma where-conditions). Conditions are
 * plain equalities so both engines interpret them identically.
 *
 * CASL answers "may this role do this kind of thing?". Stateful rules (last admin, workflow
 * state) live in services. See .claude/rules/permissions.md.
 */

export const ACTIONS = ["manage", "create", "read", "update", "delete", "changeRole"] as const;
export type Action = (typeof ACTIONS)[number];

export const SUBJECT_NAMES = ["User"] as const;
export type SubjectName = (typeof SUBJECT_NAMES)[number] | "all";

/**
 * One effective grant from the session (`session.user.permissions`); `subject` is the catalog's
 * `modelName`. Plain strings on purpose: the payload crosses JSON from Better Auth and comes from
 * free-text catalog columns. `defineRules` validates each grant once against `ACTIONS` /
 * `SUBJECT_NAMES` (Commit E3) and ignores what it does not know — fail closed.
 */
export type PermissionGrant = { action: string; subject: string };

/** The minimum the rules need to know about the current user. */
export type AbilityUser = {
  id: string;
  role: Role;
  /**
   * Effective grants (role grants ∪ user ALLOW − user DENY) carried by the session. The rules
   * read them from Commit E3 on; until then the role switch below decides.
   */
  permissions: readonly PermissionGrant[];
};

/** Attribute conditions used by the rules — equality only (mongo- and prisma-compatible). */
export type UserConditions = {
  id?: string;
};

export type CanFn = (
  action: Action | Action[],
  subject: SubjectName,
  conditions?: UserConditions,
) => void;

export const defineRules = (can: CanFn, user: AbilityUser): void => {
  // Interim until the catalog grants drive the rules (Commit E3, plan Step 17): both admin roles
  // may do everything.
  switch (user.role) {
    case "super_admin":
    case "admin":
      can("manage", "all");
      return;
    case "manager":
    case "staff":
      break;
  }

  // Everyone may see and edit their own profile.
  can(["read", "update"], "User", { id: user.id });
};

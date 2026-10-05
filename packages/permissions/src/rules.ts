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

/** The minimum the rules need to know about the current user. */
export type AbilityUser = {
  id: string;
  role: Role;
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

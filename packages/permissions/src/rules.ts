import type { Role } from "@repo/validation";

/**
 * THE permission rules — defined once, built twice: `defineAbilityFor` (browser, mongo
 * conditions) and `definePrismaAbilityFor` (API, Prisma where-conditions). Conditions are
 * plain equalities so both engines interpret them identically.
 *
 * CASL answers "may this user do this kind of thing?" from the catalog grants the session
 * carries, plus two row rules: the own User row and the user's own CommentTemplate rows. Stateful
 * rules (last admin, workflow state) live in services. See
 * .claude/rules/permissions.md and docs/adr/0003-permissions.md.
 */

/** The catalog's child-row actions (`permissions.action`); parent rows carry `all` and never grant. */
export const ACTIONS = ["create", "read", "update", "delete", "status", "changeRole"] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * The catalog's `modelName` values, then the personal subjects no catalog row grants
 * (`CommentTemplate`: a user's own 定型文, ADR 0006), which only a row rule below opens.
 */
export const SUBJECT_NAMES = [
  "User",
  "Client",
  "Staff",
  "Branch",
  "AuditLog",
  "Workflow",
  "WorkflowTemplate",
  "SourceCsvHistory",
  "CommentTemplate",
] as const;
export type SubjectName = (typeof SUBJECT_NAMES)[number];

export const isAction = (value: string): value is Action =>
  (ACTIONS as readonly string[]).includes(value);

export const isSubjectName = (value: string): value is SubjectName =>
  (SUBJECT_NAMES as readonly string[]).includes(value);

/**
 * One effective grant from the session (`session.user.permissions`); `subject` is the catalog's
 * `modelName`. Plain strings on purpose: the payload crosses JSON from Better Auth and comes from
 * free-text catalog columns. `defineRules` validates each grant once against `ACTIONS` /
 * `SUBJECT_NAMES` and ignores what it does not know — fail closed.
 */
export type PermissionGrant = { action: string; subject: string };

/** The minimum the rules need to know about the current user. */
export type AbilityUser = {
  id: string;
  /** Not an input to the grant loop; kept for row-scoped rules that depend on the role. */
  role: Role;
  /** Effective grants (role grants ∪ user ALLOW − user DENY) carried by the session. */
  permissions: readonly PermissionGrant[];
};

/** Attribute conditions used by the rules — equality only (mongo- and prisma-compatible). */
export type UserConditions = {
  id?: string;
};

export type CommentTemplateConditions = {
  createdBy?: string;
};

/** Any rule's conditions; the builders receive this union (see `CanFn`). */
export type RuleConditions = UserConditions | CommentTemplateConditions;

/**
 * How `defineRules` grants: a subject on its type, or a row subject with its own conditions only
 * (`id` on User, `createdBy` on CommentTemplate) — a mismatched pair does not compile.
 */
export type CanFn = {
  (action: Action | Action[], subject: SubjectName): void;
  (action: Action | Action[], subject: "User", conditions: UserConditions): void;
  (
    action: Action | Action[],
    subject: "CommentTemplate",
    conditions: CommentTemplateConditions,
  ): void;
};

export const defineRules = (can: CanFn, user: AbilityUser): void => {
  // Catalog grants from the session (role grants ∪ user ALLOW − user DENY), validated once: a
  // grant outside ACTIONS / SUBJECT_NAMES (parent rows carry `all`) is ignored — fail closed.
  for (const grant of user.permissions) {
    if (isAction(grant.action) && isSubjectName(grant.subject)) {
      can(grant.action, grant.subject);
    }
  }

  // Row-scoped rules go here, after the grant loop: one equality condition on a subject attribute
  // guarded by `user.role` (for example a team lead: `can("read", "User", { teamId: user.teamId })`),
  // plus the key in `UserConditions` and a spec row in test/ability.test.ts.

  // Everyone may see and edit their own profile.
  can(["read", "update"], "User", { id: user.id });

  // Personal data: everyone keeps their own 定型文 and nobody else's (ADR 0006).
  can(["create", "read", "update", "delete"], "CommentTemplate", { createdBy: user.id });
};

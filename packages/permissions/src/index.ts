// Browser-safe entry. The API uses "@repo/permissions/server" for Prisma-aware abilities.
export { canUnscoped, commentTemplateSubject, defineAbilityFor, userSubject } from "./ability";
export type { AppAbility, AppSubjects, CommentTemplateSubject, UserSubject } from "./ability";
export { ACTIONS, SUBJECT_NAMES, defineRules, isAction, isSubjectName } from "./rules";
export type {
  AbilityUser,
  Action,
  CanFn,
  CommentTemplateConditions,
  PermissionGrant,
  RuleConditions,
  SubjectName,
  UserConditions,
} from "./rules";

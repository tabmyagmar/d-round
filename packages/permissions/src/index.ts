// Browser-safe entry. The API uses "@repo/permissions/server" for Prisma-aware abilities.
export { canUnscoped, defineAbilityFor, userSubject } from "./ability";
export type { AppAbility, AppSubjects, UserSubject } from "./ability";
export { ACTIONS, SUBJECT_NAMES, defineRules, isAction, isSubjectName } from "./rules";
export type {
  AbilityUser,
  Action,
  CanFn,
  PermissionGrant,
  SubjectName,
  UserConditions,
} from "./rules";

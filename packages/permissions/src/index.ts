// Browser-safe entry. The API uses "@repo/permissions/server" for Prisma-aware abilities.
export { defineAbilityFor, userSubject } from "./ability";
export type { AppAbility, AppSubjects, UserSubject } from "./ability";
export { ACTIONS, SUBJECT_NAMES, defineRules } from "./rules";
export type { AbilityUser, Action, CanFn, SubjectName, UserConditions } from "./rules";

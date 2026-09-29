import { AbilityBuilder, createMongoAbility, subject } from "@casl/ability";
import type { ForcedSubject, MongoAbility } from "@casl/ability";

import { defineRules } from "./rules";
import type { AbilityUser, Action, SubjectName } from "./rules";

/** Shape a User record must have for attribute conditions to be evaluated. */
export type UserSubject = {
  id: string;
};

export type AppSubjects = SubjectName | (UserSubject & ForcedSubject<"User">);

/** Browser-safe ability (no Prisma). Used for hiding UI — never as the only guard. */
export type AppAbility = MongoAbility<[Action, AppSubjects]>;

/** Tags a plain record so CASL knows which rules apply: `ability.can("update", userSubject(u))`. */
export const userSubject = (record: UserSubject): UserSubject & ForcedSubject<"User"> =>
  subject("User", record);

export const defineAbilityFor = (user: AbilityUser | null): AppAbility => {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (user) {
    defineRules((action, subjectName, conditions) => {
      builder.can(action, subjectName, conditions);
    }, user);
  }
  return builder.build();
};

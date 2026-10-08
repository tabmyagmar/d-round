import { AbilityBuilder, createMongoAbility, subject } from "@casl/ability";
import type { ForcedSubject, MongoAbility, MongoQuery } from "@casl/ability";

import { defineRules } from "./rules";
import type { AbilityUser, Action, RuleConditions, SubjectName } from "./rules";

/** Shape a User record must have for attribute conditions to be evaluated. */
export type UserSubject = {
  id: string;
};

/** Shape a CommentTemplate record must have for the owner rule to be evaluated. */
export type CommentTemplateSubject = {
  createdBy: string;
};

export type AppSubjects =
  | SubjectName
  | (UserSubject & ForcedSubject<"User">)
  | (CommentTemplateSubject & ForcedSubject<"CommentTemplate">);

/** Browser-safe ability (no Prisma). Used for hiding UI — never as the only guard. */
export type AppAbility = MongoAbility<[Action, AppSubjects]>;

/** Tags a plain record so CASL knows which rules apply: `ability.can("update", userSubject(u))`. */
export const userSubject = (record: UserSubject): UserSubject & ForcedSubject<"User"> =>
  subject("User", record);

/** Tags a plain record: `ability.can("delete", commentTemplateSubject(template))`. */
export const commentTemplateSubject = (
  record: CommentTemplateSubject,
): CommentTemplateSubject & ForcedSubject<"CommentTemplate"> => subject("CommentTemplate", record);

export const defineAbilityFor = (user: AbilityUser | null): AppAbility => {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (user) {
    defineRules(
      (action: Action | Action[], subjectName: SubjectName, conditions?: RuleConditions) => {
        // CASL types conditions per literal subject; a callback over every subject gets their union,
        // whose keys (`id`, `createdBy`) no single subject shares, hence the widening.
        builder.can(action, subjectName, conditions as MongoQuery | undefined);
      },
      user,
    );
  }
  return builder.build();
};

/**
 * True when `action` on the subject type is allowed "on every row", not "on some row":
 * `ability.can(action, "User")` is optimistic (true for staff because their own row matches);
 * navigation and list links need the unscoped answer. Looks at the highest-priority rule without
 * a row condition (`rulesFor` returns rules last-defined-first, as CASL resolves them), so an
 * unconditional `cannot` defined after a `can` wins. No unconditional rule → false. Browser-safe.
 */
export const canUnscoped = (ability: AppAbility, action: Action, subject: SubjectName): boolean => {
  const rule = ability.rulesFor(action, subject).find((candidate) => !candidate.conditions);
  return rule !== undefined && !rule.inverted;
};

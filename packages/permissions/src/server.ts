import { AbilityBuilder, subject } from "@casl/ability";
import type { Ability } from "@casl/ability";
import { accessibleBy, createPrismaAbility } from "@casl/prisma/runtime";
import type { Model, PrismaQueryOf, Subjects } from "@casl/prisma/runtime";

import type { CommentTemplate, Prisma, User } from "@repo/database";

import { defineRules } from "./rules";
import type { AbilityUser, Action, RuleConditions, SubjectName } from "./rules";

/**
 * Server-side ability with Prisma where-conditions, so list endpoints can filter with
 * `accessibleBy`. Same rules as the browser ability (`./ability.ts`). Server only: this
 * entry pulls in `@prisma/client/extension`.
 */

export type PrismaQuery = PrismaQueryOf<Prisma.TypeMap>;

/** Every subject by name; the row-rule subjects also as tagged Prisma rows for row conditions. */
export type ServerSubjects =
  SubjectName | Subjects<{ User: User; CommentTemplate: CommentTemplate }>;

export type ServerAbility = Ability<[Action, ServerSubjects], PrismaQuery>;

/** Tags a Prisma User row so the server ability can evaluate row conditions. */
export const prismaUserSubject = (user: User): Model<User, "User"> => subject("User", user);

/** Tags a Prisma CommentTemplate row so the owner rule can be evaluated. */
export const prismaCommentTemplateSubject = (
  template: CommentTemplate,
): Model<CommentTemplate, "CommentTemplate"> => subject("CommentTemplate", template);

export const definePrismaAbilityFor = (user: AbilityUser | null): ServerAbility => {
  const builder = new AbilityBuilder<ServerAbility>(createPrismaAbility);
  if (user) {
    defineRules(
      (action: Action | Action[], subjectName: SubjectName, conditions?: RuleConditions) => {
        builder.can(action, subjectName, conditions);
      },
      user,
    );
  }
  return builder.build();
};

/**
 * Prisma `where` restricting a User query to rows the ability allows. Callers must check
 * `ability.can(action, "User")` first: with no matching rule CASL returns a fail-closed marker
 * condition that Prisma rejects.
 */
export const accessibleUsersWhere = (
  ability: ServerAbility,
  action: Action = "read",
): Prisma.UserWhereInput => accessibleBy(ability, action).ofType("User");

/**
 * Prisma `where` restricting a CommentTemplate query to the rows the ability allows — the caller's
 * own templates. Callers check `ability.can(action, "CommentTemplate")` first, as for users.
 */
export const accessibleCommentTemplatesWhere = (
  ability: ServerAbility,
  action: Action = "read",
): Prisma.CommentTemplateWhereInput => accessibleBy(ability, action).ofType("CommentTemplate");

export { accessibleBy };

import { AbilityBuilder, subject } from "@casl/ability";
import type { Ability } from "@casl/ability";
import { accessibleBy, createPrismaAbility } from "@casl/prisma/runtime";
import type { Model, PrismaQueryOf, Subjects } from "@casl/prisma/runtime";

import type { Client, CommentTemplate, Prisma, Staff, User } from "@repo/database";

import { canUnscoped } from "./ability";
import { defineRules } from "./rules";
import type { AbilityUser, Action, RuleConditions, SubjectName } from "./rules";

/**
 * Server-side ability with Prisma where-conditions, so list endpoints can filter with
 * `accessibleBy`. Same rules as the browser ability (`./ability.ts`). Server only: this
 * entry pulls in `@prisma/client/extension`.
 */

export type PrismaQuery = PrismaQueryOf<Prisma.TypeMap>;

/** Every subject by name; the subjects with Prisma models also as tagged rows for row checks. */
export type ServerSubjects =
  | SubjectName
  | Subjects<{ User: User; CommentTemplate: CommentTemplate; Staff: Staff; Client: Client }>;

export type ServerAbility = Ability<[Action, ServerSubjects], PrismaQuery>;

/** Tags a Prisma User row so the server ability can evaluate row conditions. */
export const prismaUserSubject = (user: User): Model<User, "User"> => subject("User", user);

/**
 * Tags a Prisma Staff row for a row check. Staff has no row rule today (the catalog grants decide),
 * so the answer equals the type's; a later rule (a 担当者 reading their staff) applies through it.
 */
export const prismaStaffSubject = (staff: Staff): Model<Staff, "Staff"> => subject("Staff", staff);

/** Tags a Prisma Client row for a row check; no row rule today, so it answers like the type. */
export const prismaClientSubject = (client: Client): Model<Client, "Client"> =>
  subject("Client", client);

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

/**
 * Prisma `where` restricting a Staff query to the rows the ability allows (everything with the
 * grant today). Callers check `ability.can(action, "Staff")` first, as for users.
 */
export const accessibleStaffWhere = (
  ability: ServerAbility,
  action: Action = "read",
): Prisma.StaffWhereInput => accessibleBy(ability, action).ofType("Staff");

/**
 * Prisma `where` restricting a Client query to the rows the ability allows (everything with the
 * grant today). Callers check `ability.can(action, "Client")` first, as for users.
 */
export const accessibleClientsWhere = (
  ability: ServerAbility,
  action: Action = "read",
): Prisma.ClientWhereInput => accessibleBy(ability, action).ofType("Client");

export { accessibleBy, canUnscoped };

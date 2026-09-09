import { AbilityBuilder } from "@casl/ability";
import type { Ability } from "@casl/ability";
import { accessibleBy, createPrismaAbility } from "@casl/prisma/runtime";
import type { PrismaQueryOf, Subjects } from "@casl/prisma/runtime";

import type { Prisma, User } from "@repo/database";

import { defineRules } from "./rules";
import type { AbilityUser, Action } from "./rules";

/**
 * Server-side ability with Prisma where-conditions, so list endpoints can filter with
 * `accessibleBy`. Same rules as the browser ability (`./ability.ts`). Server only: this
 * entry pulls in `@prisma/client/extension`.
 */

export type PrismaQuery = PrismaQueryOf<Prisma.TypeMap>;

export type ServerSubjects = "all" | Subjects<{ User: User }>;

export type ServerAbility = Ability<[Action, ServerSubjects], PrismaQuery>;

export const definePrismaAbilityFor = (user: AbilityUser | null): ServerAbility => {
  const builder = new AbilityBuilder<ServerAbility>(createPrismaAbility);
  if (user) {
    defineRules((action, subjectName, conditions) => {
      builder.can(action, subjectName, conditions);
    }, user);
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

export { accessibleBy };

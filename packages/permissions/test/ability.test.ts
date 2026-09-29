/**
 * THE PERMISSION SPEC.
 *
 * Every role × action × relation combination is asserted here. Changing permissions means
 * changing this table first (the failing row documents the change), then `rules.ts`.
 * Relations: self = the current user, other = any other user.
 */
import { describe, expect, it } from "vitest";

import type { Role } from "@repo/validation";

import { defineAbilityFor, userSubject } from "../src/ability";
import { ACTIONS } from "../src/rules";
import type { AbilityUser, Action } from "../src/rules";
import { accessibleUsersWhere, definePrismaAbilityFor } from "../src/server";

type Relation = "self" | "other";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";
const OTHER_ID = "019187d5-0d76-7d1a-9a4c-000000000002";

const me = (role: Role): AbilityUser => ({ id: ME_ID, role });

const targets: Record<Relation, (user: AbilityUser) => { id: string }> = {
  self: (user) => ({ id: user.id }),
  other: () => ({ id: OTHER_ID }),
};

/** allowed[role][action] = relations for which the action is allowed. */
const allowed: Record<Role, Partial<Record<Action, Relation[]>>> = {
  admin: {
    manage: ["self", "other"],
    create: ["self", "other"],
    read: ["self", "other"],
    update: ["self", "other"],
    delete: ["self", "other"],
    changeRole: ["self", "other"],
  },
  member: {
    read: ["self"],
    update: ["self"],
  },
};

const RELATIONS: Relation[] = ["self", "other"];
const ROLES: Role[] = ["admin", "member"];

describe("ability matrix (role × action × relation)", () => {
  for (const role of ROLES) {
    for (const action of ACTIONS) {
      for (const relation of RELATIONS) {
        const expected = allowed[role][action]?.includes(relation) ?? false;
        it(`${role} ${expected ? "CAN" : "CANNOT"} ${action} User (${relation})`, () => {
          const user = me(role);
          const ability = defineAbilityFor(user);
          const target = userSubject(targets[relation](user));
          expect(ability.can(action, target)).toBe(expected);
        });
      }
    }
  }
});

describe("edge cases", () => {
  it("an anonymous visitor can do nothing", () => {
    const ability = defineAbilityFor(null);
    expect(ability.can("read", "User")).toBe(false);
    expect(ability.can("read", userSubject({ id: "x" }))).toBe(false);
  });

  it("the server (prisma) ability answers the same as the browser ability", () => {
    for (const role of ROLES) {
      const user = me(role);
      const browser = defineAbilityFor(user);
      const server = definePrismaAbilityFor(user);
      for (const action of ACTIONS) {
        for (const relation of RELATIONS) {
          const target = userSubject(targets[relation](user));
          // The server ability is typed with the full Prisma User model; the rules only read id.
          expect(server.can(action, target as never)).toBe(browser.can(action, target));
        }
      }
    }
  });
});

describe("accessibleUsersWhere", () => {
  it("restricts members to their own row", () => {
    const user = me("member");
    const where = accessibleUsersWhere(definePrismaAbilityFor(user));
    expect(JSON.stringify(where)).toContain(user.id);
    expect(JSON.stringify(where)).not.toContain(OTHER_ID);
  });

  it("lets an admin read everyone (no id restriction)", () => {
    const where = accessibleUsersWhere(definePrismaAbilityFor(me("admin")));
    expect(JSON.stringify(where)).not.toContain(ME_ID);
  });
});

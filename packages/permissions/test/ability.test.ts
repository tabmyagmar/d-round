/**
 * THE PERMISSION SPEC.
 *
 * Every role × action × relation combination is asserted here. Changing permissions means
 * changing this table first (the failing row documents the change), then `rules.ts`.
 * Relations: self = the current user, same-dept = another user in the same department,
 * other-dept = a user in a different department.
 */
import { describe, expect, it } from "vitest";

import type { Role } from "@repo/validation";

import { defineAbilityFor, userSubject } from "../src/ability";
import { ACTIONS } from "../src/rules";
import type { AbilityUser, Action } from "../src/rules";
import { accessibleUsersWhere, definePrismaAbilityFor } from "../src/server";

type Relation = "self" | "same-dept" | "other-dept";

const me = (role: Role, department: string | null = "HR"): AbilityUser => ({
  id: "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e",
  role,
  department,
});

const targets: Record<Relation, (user: AbilityUser) => { id: string; department: string | null }> =
  {
    self: (user) => ({ id: user.id, department: user.department }),
    "same-dept": (user) => ({
      id: "019187d5-0d76-7d1a-9a4c-000000000002",
      department: user.department,
    }),
    "other-dept": () => ({ id: "019187d5-0d76-7d1a-9a4c-000000000003", department: "IT" }),
  };

/** allowed[role][action] = relations for which the action is allowed. */
const allowed: Record<Role, Partial<Record<Action, Relation[]>>> = {
  admin: {
    manage: ["self", "same-dept", "other-dept"],
    create: ["self", "same-dept", "other-dept"],
    read: ["self", "same-dept", "other-dept"],
    update: ["self", "same-dept", "other-dept"],
    delete: ["self", "same-dept", "other-dept"],
    changeRole: ["self", "same-dept", "other-dept"],
  },
  hr_manager: {
    read: ["self", "same-dept", "other-dept"],
    update: ["self", "same-dept"],
  },
  dept_head: {
    read: ["self", "same-dept"],
    update: ["self"],
  },
  member: {
    read: ["self"],
    update: ["self"],
  },
};

const RELATIONS: Relation[] = ["self", "same-dept", "other-dept"];
const ROLES: Role[] = ["admin", "hr_manager", "dept_head", "member"];

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
    expect(ability.can("read", userSubject({ id: "x", department: null }))).toBe(false);
  });

  it("an hr_manager without a department cannot update anyone but themselves", () => {
    const user = me("hr_manager", null);
    const ability = defineAbilityFor(user);
    expect(ability.can("update", userSubject({ id: user.id, department: null }))).toBe(true);
    expect(ability.can("update", userSubject({ id: "other", department: null }))).toBe(false);
    expect(ability.can("read", userSubject({ id: "other", department: "IT" }))).toBe(true);
  });

  it("the server (prisma) ability answers the same as the browser ability", () => {
    for (const role of ROLES) {
      const user = me(role);
      const browser = defineAbilityFor(user);
      const server = definePrismaAbilityFor(user);
      for (const action of ACTIONS) {
        for (const relation of RELATIONS) {
          const target = userSubject(targets[relation](user));
          // The server ability is typed with the full Prisma User model; the rules only read id/department.
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
    expect(JSON.stringify(where)).not.toContain("IT");
  });

  it("lets an hr_manager read everyone (no id restriction)", () => {
    const where = accessibleUsersWhere(definePrismaAbilityFor(me("hr_manager")));
    expect(JSON.stringify(where)).not.toContain("019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e");
  });

  it("scopes dept_head updates to nothing and reads to the department", () => {
    const user = me("dept_head");
    const ability = definePrismaAbilityFor(user);
    expect(ability.can("update", "User")).toBe(true); // self rule exists
    expect(JSON.stringify(accessibleUsersWhere(ability, "read"))).toContain("HR");
  });
});

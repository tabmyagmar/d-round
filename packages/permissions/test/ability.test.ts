/**
 * THE PERMISSION SPEC.
 *
 * Every role × action × relation combination is asserted here. Changing permissions means
 * changing this table first (the failing row documents the change), then `rules.ts`.
 * Relations: self = the current user, other = any other user.
 */
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { describe, expect, it } from "vitest";

import { ROLES } from "@repo/validation";
import type { Role } from "@repo/validation";

import { canUnscoped, defineAbilityFor, userSubject } from "../src/ability";
import type { AppAbility } from "../src/ability";
import { ACTIONS } from "../src/rules";
import type { AbilityUser, Action } from "../src/rules";
import { accessibleUsersWhere, definePrismaAbilityFor } from "../src/server";

type Relation = "self" | "other";

const ME_ID = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";
const OTHER_ID = "019187d5-0d76-7d1a-9a4c-000000000002";

const me = (role: Role): AbilityUser => ({ id: ME_ID, role, permissions: [] });

const targets: Record<Relation, (user: AbilityUser) => { id: string }> = {
  self: (user) => ({ id: user.id }),
  other: () => ({ id: OTHER_ID }),
};

type Allowed = Partial<Record<Action, Relation[]>>;

/** Every action on everyone (interim `manage all` until the catalog grants arrive in E3). */
const FULL_ACCESS: Allowed = {
  manage: ["self", "other"],
  create: ["self", "other"],
  read: ["self", "other"],
  update: ["self", "other"],
  delete: ["self", "other"],
  changeRole: ["self", "other"],
};

/** Only the own profile: read and update, nothing on other users. */
const SELF_ONLY: Allowed = {
  read: ["self"],
  update: ["self"],
};

/** allowed[role][action] = relations for which the action is allowed. */
const allowed: Record<Role, Allowed> = {
  super_admin: FULL_ACCESS,
  admin: FULL_ACCESS,
  manager: SELF_ONLY,
  staff: SELF_ONLY,
};

const RELATIONS: Relation[] = ["self", "other"];

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

describe("canUnscoped", () => {
  it.each(["super_admin", "admin"] as const)(
    "is true for a %s reading User (their `manage all` rule carries no conditions)",
    (role) => {
      expect(canUnscoped(defineAbilityFor(me(role)), "read", "User")).toBe(true);
    },
  );

  it.each(["manager", "staff"] as const)(
    "is false for a %s reading User (only the conditional self rule applies)",
    (role) => {
      const ability = defineAbilityFor(me(role));
      // `can` on the bare subject type is optimistic (some row may match); the unscoped check is not.
      expect(ability.can("read", "User")).toBe(true);
      expect(canUnscoped(ability, "read", "User")).toBe(false);
    },
  );

  it("is false for an anonymous visitor", () => {
    expect(canUnscoped(defineAbilityFor(null), "read", "User")).toBe(false);
  });

  it("honours CASL priority: a later unconditional `cannot` overrides an earlier `can`", () => {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    builder.can("read", "User");
    builder.cannot("read", "User");
    expect(canUnscoped(builder.build(), "read", "User")).toBe(false);
  });

  it("honours CASL priority: a later unconditional `can` overrides an earlier `cannot`", () => {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    builder.cannot("read", "User");
    builder.can("read", "User");
    expect(canUnscoped(builder.build(), "read", "User")).toBe(true);
  });
});

describe("accessibleUsersWhere", () => {
  it.each(["manager", "staff"] as const)("restricts a %s to their own row", (role) => {
    const user = me(role);
    const where = accessibleUsersWhere(definePrismaAbilityFor(user));
    expect(JSON.stringify(where)).toContain(user.id);
    expect(JSON.stringify(where)).not.toContain(OTHER_ID);
  });

  it.each(["super_admin", "admin"] as const)(
    "lets a %s read everyone (no id restriction)",
    (role) => {
      const where = accessibleUsersWhere(definePrismaAbilityFor(me(role)));
      expect(JSON.stringify(where)).not.toContain(ME_ID);
    },
  );
});

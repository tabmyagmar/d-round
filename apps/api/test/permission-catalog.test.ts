import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission, User } from "@repo/database";
import { ACTIONS, isAction, isSubjectName } from "@repo/permissions";
import { prismaUserSubject } from "@repo/permissions/server";
import { ROLES } from "@repo/validation";

import type { RequestContext } from "../src/core/context";

import { contextFor, createHarness, signedInUser } from "./support";
import type { TestHarness } from "./support";

/**
 * THE PERMISSION SPEC — catalog half. The unit half (`packages/permissions/test/ability.test.ts`)
 * proves what one grant does; this file proves that, after the seed, every role's ability is
 * exactly its `role_permissions` rows (session → `customSession` grants → `defineRules`), that a
 * parent row (`all`) never grants, and that a user's ALLOW / DENY rows add to and remove from the
 * role's grants. Changing who may do what is a `permissions.csv` change that fails here first.
 */

let h: TestHarness;
/** A User row that is never the signed-in user, so the self rule cannot answer for a grant. */
let other: User;

beforeAll(async () => {
  h = await createHarness();
  other = await h.db.user.create({
    data: { name: "Other", email: `${crypto.randomUUID()}@example.com` },
  });
});

afterAll(async () => {
  await h.stop();
});

const catalog = (): Promise<Permission[]> => h.db.permission.findMany({ orderBy: { key: "asc" } });

/**
 * The ability's answer for a catalog row: on the subject type, or on another user's row for `User`.
 * A parent row (`all`) is not an Action, so it is false here and in the expectation by construction;
 * the "ALLOW on a parent row" case below is what proves a parent row never grants.
 */
const allows = (ctx: RequestContext, row: Permission): boolean =>
  isAction(row.action) &&
  isSubjectName(row.modelName) &&
  ctx.ability.can(row.action, row.modelName === "User" ? prismaUserSubject(other) : row.modelName);

/** One boolean per catalog row, keyed so a failure names the row. */
const perRow = (
  rows: Permission[],
  decide: (row: Permission) => boolean,
): Record<string, boolean> =>
  Object.fromEntries(rows.map((row) => [`${row.key} ${row.action} ${row.modelName}`, decide(row)]));

describe("the catalog fits the typed lists", () => {
  it("every action is `all` (a parent row) or an Action, every modelName a SubjectName", async () => {
    const rows = await catalog();

    expect(rows).toHaveLength(43);
    expect(rows.filter((row) => row.action !== "all" && !isAction(row.action))).toEqual([]);
    expect(rows.filter((row) => !isSubjectName(row.modelName))).toEqual([]);
  });
});

describe("role_permissions = ability", () => {
  for (const role of ROLES) {
    it(`${role} may do exactly what its role_permissions rows grant`, async () => {
      const signedIn = await signedInUser(h, { role });
      const granted = new Set(
        (
          await h.db.rolePermission.findMany({
            where: { roleKey: role },
            select: { permissionKey: true },
          })
        ).map((row) => row.permissionKey),
      );
      const rows = await catalog();

      const ctx = await contextFor(h, signedIn.headers);

      expect(granted.size).toBeGreaterThan(0);
      expect(perRow(rows, (row) => allows(ctx, row))).toEqual(
        perRow(rows, (row) => row.action !== "all" && granted.has(row.key)),
      );
    });
  }

  it.each(["manager", "staff"] as const)(
    "%s may not change roles (row 1106 is granted to the admin roles only)",
    async (role) => {
      const signedIn = await signedInUser(h, { role });

      const ctx = await contextFor(h, signedIn.headers);

      expect(ctx.ability.can("changeRole", "User")).toBe(false);
    },
  );
});

describe("user_permissions on top of the role", () => {
  it("an ALLOW row adds a grant: staff with ALLOW 1101 gains `create User` in the ability", async () => {
    const staff = await signedInUser(h, { role: "staff" });
    expect((await contextFor(h, staff.headers)).ability.can("create", "User")).toBe(false);

    await h.db.userPermission.create({
      data: { userId: staff.user.id, permissionKey: "1101", effect: "ALLOW" },
    });

    expect((await contextFor(h, staff.headers)).ability.can("create", "User")).toBe(true);
  });

  it("a DENY row removes a role grant: admin with DENY 1102 reads only their own row", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    expect((await contextFor(h, admin.headers)).ability.can("read", prismaUserSubject(other))).toBe(
      true,
    );

    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1102", effect: "DENY" },
    });

    const ctx = await contextFor(h, admin.headers);
    expect(ctx.ability.can("read", prismaUserSubject(other))).toBe(false);
    expect(ctx.ability.can("read", prismaUserSubject(admin.user))).toBe(true);
    // The other role grants are untouched.
    expect(ctx.ability.can("update", prismaUserSubject(other))).toBe(true);
  });

  it("an ALLOW row on a parent row (`all`) reaches the session but grants nothing", async () => {
    const staff = await signedInUser(h, { role: "staff" });

    await h.db.userPermission.create({
      data: { userId: staff.user.id, permissionKey: "1100", effect: "ALLOW" },
    });

    const ctx = await contextFor(h, staff.headers);
    expect(ctx.user?.permissions).toContainEqual({ action: "all", subject: "User" });
    for (const action of ACTIONS) {
      expect(ctx.ability.can(action, prismaUserSubject(other))).toBe(false);
    }
  });
});

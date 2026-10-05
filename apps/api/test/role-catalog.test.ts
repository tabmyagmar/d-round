import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { roles } from "@repo/auth";
import { isForeignKeyViolation } from "@repo/database";
import { ADMIN_ROLES, DEFAULT_ROLE, ROLES } from "@repo/validation";

import { createHarness, signedInUser } from "./support";
import type { TestHarness } from "./support";

/**
 * One role set in three places: `ROLES` (@repo/validation), Better Auth's `roles` map
 * (@repo/auth) and the `roles` rows the migration inserts. The foreign key
 * `users.role → roles.key` makes the database the last line of defence.
 */

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("role catalog parity", () => {
  it("ROLES, the Better Auth roles map and the roles table agree on the same keys", async () => {
    const expected = [...ROLES].sort();
    const rows = await h.db.role.findMany({ select: { key: true } });

    expect(Object.keys(roles).sort()).toEqual(expected);
    expect(rows.map((row) => row.key).sort()).toEqual(expected);
  });

  it("the default role and every admin role are catalog roles", () => {
    expect(ROLES).toContain(DEFAULT_ROLE);
    for (const role of ADMIN_ROLES) {
      expect(ROLES).toContain(role);
    }
  });
});

describe("users.role foreign key", () => {
  it("refuses a role outside the catalog", async () => {
    const signedIn = await signedInUser(h, { role: "staff" });

    await expect(
      h.db.user.update({ where: { id: signedIn.user.id }, data: { role: "ceo" } }),
    ).rejects.toSatisfy(isForeignKeyViolation);
    expect((await h.db.user.findUniqueOrThrow({ where: { id: signedIn.user.id } })).role).toBe(
      "staff",
    );
  });

  it("refuses to delete a role while a user holds it", async () => {
    await signedInUser(h, { role: "staff" });

    await expect(h.db.role.delete({ where: { key: "staff" } })).rejects.toSatisfy(
      isForeignKeyViolation,
    );
    expect(await h.db.role.findUnique({ where: { key: "staff" } })).not.toBeNull();
  });

  it("gives a user created without a role the default staff", async () => {
    const user = await h.db.user.create({
      data: { name: "No role", email: `${crypto.randomUUID()}@example.com` },
    });

    expect(user.role).toBe("staff");
    expect(user.role).toBe(DEFAULT_ROLE);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ADMIN_ROLES, listUsersSchema } from "@repo/validation";
import type { ListUsersInput } from "@repo/validation";

import { ConflictError, ForbiddenError, NotFoundError } from "../../../src/core/errors";
import * as userService from "../../../src/modules/user/user.service";
import { contextFor, createHarness, signedInUser, TEST_PASSWORD } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const tag = () => `tag-${crypto.randomUUID().slice(0, 8)}`;

/** The query exactly as the router hands it to the service: parsed, defaults applied. */
const listQuery = (input: ListUsersInput) => listUsersSchema.parse(input);

/**
 * Leaves only `keep` active among the admin roles: every other active admin-role user becomes
 * staff until the returned restore function puts each one's original role back. All API test
 * files share one database, so this is how a test reaches the last-admin boundary.
 */
const parkOtherAdmins = async (keep: string[]): Promise<() => Promise<void>> => {
  const parked = await h.db.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] }, deletedAt: null, id: { notIn: keep } },
    select: { id: true, role: true },
  });
  await h.db.user.updateMany({
    where: { id: { in: parked.map((u) => u.id) } },
    data: { role: "staff" },
  });
  return async () => {
    for (const role of ADMIN_ROLES) {
      const ids = parked.filter((u) => u.role === role).map((u) => u.id);
      await h.db.user.updateMany({ where: { id: { in: ids } }, data: { role } });
    }
  };
};

describe("getById", () => {
  it("lets everyone read themselves and admins read anyone", async () => {
    const staff = await signedInUser(h);
    const admin = await signedInUser(h, { role: "admin" });

    expect((await userService.getById(await contextFor(h, staff.headers), staff.user.id)).id).toBe(
      staff.user.id,
    );
    expect((await userService.getById(await contextFor(h, admin.headers), staff.user.id)).id).toBe(
      staff.user.id,
    );
  });

  it("forbids staff from reading other users", async () => {
    const staff = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.getById(await contextFor(h, staff.headers), other.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("treats deactivated users as not found", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const victim = await signedInUser(h);
    await h.db.user.update({ where: { id: victim.user.id }, data: { deletedAt: new Date() } });

    await expect(
      userService.getById(await contextFor(h, admin.headers), victim.user.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("list", () => {
  it("returns only what the ability allows and filters by search/role", async () => {
    const marker = tag();
    const admin = await signedInUser(h, { role: "admin", name: "Admin Person" });
    const staff = await signedInUser(h, { name: `Zed ${marker}` });

    const asAdmin = await userService.list(
      await contextFor(h, admin.headers),
      listQuery({ page: 1, perPage: 50, search: marker }),
    );
    expect(asAdmin.items.map((u) => u.id)).toEqual([staff.user.id]);

    const asStaff = await userService.list(
      await contextFor(h, staff.headers),
      listQuery({ page: 1, perPage: 50 }),
    );
    expect(asStaff.total).toBe(1);
    expect(asStaff.items[0]?.id).toBe(staff.user.id);

    const onlyAdmins = await userService.list(
      await contextFor(h, admin.headers),
      listQuery({ page: 1, perPage: 5, role: "admin" }),
    );
    expect(onlyAdmins.items.every((u) => u.role === "admin")).toBe(true);
  });

  it("lists deactivated users only when asked, in the requested order", async () => {
    const marker = tag();
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    // Created A then B, so the default newest-first order (B, A) differs from name ascending.
    const amy = await signedInUser(h, { name: `Amy ${marker}` });
    const bob = await signedInUser(h, { name: `Bob ${marker}` });
    const cid = await signedInUser(h, { name: `Cid ${marker}` });
    await userService.deactivate(ctx, cid.user.id);

    const active = await userService.list(
      ctx,
      listQuery({ search: marker, sortBy: "name", sortOrder: "asc" }),
    );
    const deactivated = await userService.list(
      ctx,
      listQuery({ search: marker, status: "deactivated" }),
    );

    expect(active.items.map((u) => u.id)).toEqual([amy.user.id, bob.user.id]);
    expect(deactivated.items.map((u) => u.id)).toEqual([cid.user.id]);
  });
});

describe("updateProfile", () => {
  it("lets users edit themselves and admins edit anyone", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);

    const self = await userService.updateProfile(await contextFor(h, staff.headers), {
      name: "Renamed Self",
    });
    expect(self.name).toBe("Renamed Self");

    const byAdmin = await userService.updateProfile(await contextFor(h, admin.headers), {
      userId: staff.user.id,
      name: "Renamed By Admin",
    });
    expect(byAdmin.name).toBe("Renamed By Admin");
  });

  it("forbids staff from editing other users", async () => {
    const staff = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.updateProfile(await contextFor(h, staff.headers), {
        userId: other.user.id,
        name: "Nope",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("changeRole", () => {
  it("is admin-only and refuses to demote the last admin", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);
    const adminCtx = await contextFor(h, admin.headers);

    await expect(
      userService.changeRole(await contextFor(h, staff.headers), {
        userId: admin.user.id,
        role: "staff",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const promoted = await userService.changeRole(adminCtx, {
      userId: staff.user.id,
      role: "admin",
    });
    expect(promoted.role).toBe("admin");
    const demoted = await userService.changeRole(adminCtx, {
      userId: staff.user.id,
      role: "staff",
    });
    expect(demoted.role).toBe("staff");

    // Make `admin` the only active admin-role user, then try to demote them.
    const restore = await parkOtherAdmins([admin.user.id]);
    try {
      await expect(
        userService.changeRole(adminCtx, { userId: admin.user.id, role: "staff" }),
      ).rejects.toThrow("Cannot demote the last admin");
    } finally {
      await restore();
    }
  });

  it("counts every admin role: the only admin may step down while a super_admin stays", async () => {
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const admin = await signedInUser(h, { role: "admin" });
    const superAdminCtx = await contextFor(h, superAdmin.headers);

    const restore = await parkOtherAdmins([superAdmin.user.id, admin.user.id]);
    try {
      const demoted = await userService.changeRole(superAdminCtx, {
        userId: admin.user.id,
        role: "staff",
      });
      expect(demoted.role).toBe("staff");

      // The super_admin is now the last active admin-role user.
      await expect(
        userService.changeRole(superAdminCtx, { userId: superAdmin.user.id, role: "manager" }),
      ).rejects.toThrow("Cannot demote the last admin");
    } finally {
      await restore();
    }
  });

  it("lets the last admin-role user move to the other admin role", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const adminCtx = await contextFor(h, admin.headers);

    const restore = await parkOtherAdmins([admin.user.id]);
    try {
      const moved = await userService.changeRole(adminCtx, {
        userId: admin.user.id,
        role: "super_admin",
      });
      expect(moved.role).toBe("super_admin");
    } finally {
      await restore();
    }
  });
});

describe("deactivate", () => {
  it("soft-deletes, bans and revokes the user's sessions", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const victim = await signedInUser(h);
    expect(await h.auth.api.getSession({ headers: victim.headers })).not.toBeNull();

    const result = await userService.deactivate(await contextFor(h, admin.headers), victim.user.id);

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.banned).toBe(true);
    expect(await h.auth.api.getSession({ headers: victim.headers })).toBeNull();
    await expect(
      h.auth.api.signInEmail({ body: { email: victim.email, password: "correct-horse-battery" } }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("lets a non-admin holding `status User` deactivate a user and ends that user's sessions", async () => {
    const actor = await signedInUser(h);
    const target = await signedInUser(h);
    // A user ALLOW row on 1105 gives this staff user `status User`; grants are read at session
    // lookup, so the row goes in before the context is built.
    await h.db.userPermission.create({
      data: { userId: actor.user.id, permissionKey: "1105", effect: "ALLOW" },
    });

    const result = await userService.deactivate(await contextFor(h, actor.headers), target.user.id);

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.banned).toBe(true);
    expect(await h.auth.api.getSession({ headers: target.headers })).toBeNull();
    expect(await h.auth.api.getSession({ headers: actor.headers })).not.toBeNull();
  });

  it("refuses self-deactivation and callers without `status User`", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);

    await expect(
      userService.deactivate(await contextFor(h, admin.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ConflictError);

    const denied = userService.deactivate(await contextFor(h, staff.headers), admin.user.id);
    await expect(denied).rejects.toBeInstanceOf(ForbiddenError);
    await expect(denied).rejects.toThrow("Not allowed to change user status");
  });

  it("refuses an admin whose `status User` grant a user DENY row removes", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const target = await signedInUser(h);
    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1105", effect: "DENY" },
    });

    await expect(
      userService.deactivate(await contextFor(h, admin.headers), target.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.auth.api.getSession({ headers: target.headers })).not.toBeNull();
  });

  it("keeps at least one active user across both admin roles", async () => {
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const admin = await signedInUser(h, { role: "admin" });
    const superAdminCtx = await contextFor(h, superAdmin.headers);
    const adminCtx = await contextFor(h, admin.headers);

    const restore = await parkOtherAdmins([superAdmin.user.id, admin.user.id]);
    try {
      // The only `admin` may go while a super_admin stays active.
      const gone = await userService.deactivate(superAdminCtx, admin.user.id);
      expect(gone.deletedAt).toBeInstanceOf(Date);

      // The super_admin is now the last active admin-role user. `adminCtx` was built while
      // `admin` was active (the self-check would mask the rule for the super_admin's own
      // context); the stateful rule, not the ability, is what protects the last admin.
      await expect(userService.deactivate(adminCtx, superAdmin.user.id)).rejects.toThrow(
        "Cannot deactivate the last admin",
      );
      // The refused deactivation rolled back, sessions included.
      expect(await h.auth.api.getSession({ headers: superAdmin.headers })).not.toBeNull();
    } finally {
      await restore();
    }
  });
});

describe("reactivate", () => {
  it("restores a deactivated user, who can sign in again", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const target = await signedInUser(h);
    await userService.deactivate(ctx, target.user.id);

    const restored = await userService.reactivate(ctx, target.user.id);

    expect(restored.deletedAt).toBeNull();
    expect(restored.banned).toBe(false);
    expect((await userService.getById(ctx, target.user.id)).id).toBe(target.user.id);
    await expect(
      h.auth.api.signInEmail({ body: { email: target.email, password: TEST_PASSWORD } }),
    ).resolves.toMatchObject({ user: { id: target.user.id } });
  });

  it("treats an active user as not found, as deactivate treats a deactivated one", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const target = await signedInUser(h);

    await expect(
      userService.reactivate(await contextFor(h, admin.headers), target.user.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a caller without `status User`", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);
    const target = await signedInUser(h);
    await userService.deactivate(await contextFor(h, admin.headers), target.user.id);

    await expect(
      userService.reactivate(await contextFor(h, staff.headers), target.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("invite", () => {
  const outboxFor = (to: string) => h.db.outboxEmail.findMany({ where: { to } });

  it("creates the user with the role and no password, unverified, and mails the invitation", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const email = `${crypto.randomUUID()}@example.com`;

    const invited = await userService.invite(await contextFor(h, admin.headers), {
      email,
      name: "招待 花子",
      role: "manager",
    });

    expect(invited).toMatchObject({
      email,
      name: "招待 花子",
      role: "manager",
      emailVerified: false,
    });
    expect(await h.db.account.count({ where: { userId: invited.id } })).toBe(0);
    const rows = await outboxFor(email);
    expect(rows.map((row) => row.template)).toEqual(["account-invitation"]);
    expect(rows[0]?.payload).toMatchObject({ name: "招待 花子" });
  });

  it("refuses an email that is already registered", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const existing = await signedInUser(h);

    await expect(
      userService.invite(await contextFor(h, admin.headers), {
        email: existing.email,
        name: "Again",
        role: "staff",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a caller without `create User`", async () => {
    const staff = await signedInUser(h);
    const email = `${crypto.randomUUID()}@example.com`;

    await expect(
      userService.invite(await contextFor(h, staff.headers), { email, name: "No", role: "staff" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.db.user.findUnique({ where: { email } })).toBeNull();
  });
});

describe("sendPasswordReset", () => {
  const outboxFor = (to: string) => h.db.outboxEmail.findMany({ where: { to } });

  it("mails a reset link to a user who has a password", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const target = await signedInUser(h);

    await userService.sendPasswordReset(await contextFor(h, admin.headers), target.user.id);

    expect((await outboxFor(target.email)).map((row) => row.template)).toEqual(["password-reset"]);
  });

  it("re-sends the invitation to a user who never set a password", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const email = `${crypto.randomUUID()}@example.com`;
    const invited = await userService.invite(ctx, { email, name: "Late", role: "staff" });

    await userService.sendPasswordReset(ctx, invited.id);

    expect((await outboxFor(email)).map((row) => row.template)).toEqual([
      "account-invitation",
      "account-invitation",
    ]);
  });

  it("refuses a caller without `update User` on that user, and unknown or deactivated users", async () => {
    const staff = await signedInUser(h);
    const other = await signedInUser(h);
    await expect(
      userService.sendPasswordReset(await contextFor(h, staff.headers), other.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const admin = await signedInUser(h, { role: "admin" });
    const adminCtx = await contextFor(h, admin.headers);
    await expect(
      userService.sendPasswordReset(adminCtx, crypto.randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundError);

    const gone = await signedInUser(h);
    await userService.deactivate(adminCtx, gone.user.id);
    await expect(userService.sendPasswordReset(adminCtx, gone.user.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await outboxFor(gone.email)).toHaveLength(0);
  });
});

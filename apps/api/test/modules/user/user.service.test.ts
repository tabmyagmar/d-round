import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ADMIN_ROLES } from "@repo/validation";

import { ConflictError, ForbiddenError, NotFoundError } from "../../../src/core/errors";
import * as userService from "../../../src/modules/user/user.service";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const tag = () => `tag-${crypto.randomUUID().slice(0, 8)}`;

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

    const asAdmin = await userService.list(await contextFor(h, admin.headers), {
      page: 1,
      perPage: 50,
      search: marker,
    });
    expect(asAdmin.items.map((u) => u.id)).toEqual([staff.user.id]);

    const asStaff = await userService.list(await contextFor(h, staff.headers), {
      page: 1,
      perPage: 50,
    });
    expect(asStaff.total).toBe(1);
    expect(asStaff.items[0]?.id).toBe(staff.user.id);

    const onlyAdmins = await userService.list(await contextFor(h, admin.headers), {
      page: 1,
      perPage: 5,
      role: "admin",
    });
    expect(onlyAdmins.items.every((u) => u.role === "admin")).toBe(true);
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

  it("refuses self-deactivation and non-admins", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);

    await expect(
      userService.deactivate(await contextFor(h, admin.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      userService.deactivate(await contextFor(h, staff.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
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
    } finally {
      await restore();
    }
  });
});

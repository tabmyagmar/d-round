import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describe("getById", () => {
  it("lets everyone read themselves and admins read anyone", async () => {
    const member = await signedInUser(h);
    const admin = await signedInUser(h, { role: "admin" });

    expect(
      (await userService.getById(await contextFor(h, member.headers), member.user.id)).id,
    ).toBe(member.user.id);
    expect((await userService.getById(await contextFor(h, admin.headers), member.user.id)).id).toBe(
      member.user.id,
    );
  });

  it("forbids members from reading other users", async () => {
    const member = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.getById(await contextFor(h, member.headers), other.user.id),
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
    const member = await signedInUser(h, { name: `Zed ${marker}` });

    const asAdmin = await userService.list(await contextFor(h, admin.headers), {
      page: 1,
      perPage: 50,
      search: marker,
    });
    expect(asAdmin.items.map((u) => u.id)).toEqual([member.user.id]);

    const asMember = await userService.list(await contextFor(h, member.headers), {
      page: 1,
      perPage: 50,
    });
    expect(asMember.total).toBe(1);
    expect(asMember.items[0]?.id).toBe(member.user.id);

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
    const member = await signedInUser(h);

    const self = await userService.updateProfile(await contextFor(h, member.headers), {
      name: "Renamed Self",
    });
    expect(self.name).toBe("Renamed Self");

    const byAdmin = await userService.updateProfile(await contextFor(h, admin.headers), {
      userId: member.user.id,
      name: "Renamed By Admin",
    });
    expect(byAdmin.name).toBe("Renamed By Admin");
  });

  it("forbids members from editing other users", async () => {
    const member = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.updateProfile(await contextFor(h, member.headers), {
        userId: other.user.id,
        name: "Nope",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("changeRole", () => {
  it("is admin-only and refuses to demote the last admin", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const member = await signedInUser(h);
    const adminCtx = await contextFor(h, admin.headers);

    await expect(
      userService.changeRole(await contextFor(h, member.headers), {
        userId: admin.user.id,
        role: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const promoted = await userService.changeRole(adminCtx, {
      userId: member.user.id,
      role: "admin",
    });
    expect(promoted.role).toBe("admin");
    const demoted = await userService.changeRole(adminCtx, {
      userId: member.user.id,
      role: "member",
    });
    expect(demoted.role).toBe("member");

    // Make `admin` the only active admin, then try to demote them.
    const otherAdmins = await h.db.user.findMany({
      where: { role: "admin", deletedAt: null, id: { not: admin.user.id } },
      select: { id: true },
    });
    const parked = otherAdmins.map((u) => u.id);
    await h.db.user.updateMany({ where: { id: { in: parked } }, data: { role: "member" } });
    try {
      await expect(
        userService.changeRole(adminCtx, { userId: admin.user.id, role: "member" }),
      ).rejects.toBeInstanceOf(ConflictError);
    } finally {
      await h.db.user.updateMany({ where: { id: { in: parked } }, data: { role: "admin" } });
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
    const member = await signedInUser(h);

    await expect(
      userService.deactivate(await contextFor(h, admin.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      userService.deactivate(await contextFor(h, member.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

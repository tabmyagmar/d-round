import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ADMIN_ROLES, listUsersSchema } from "@repo/validation";
import type { ListUsersInput, UserProfileInput } from "@repo/validation";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../src/core/errors";
import * as userService from "../../../src/modules/user/user.service";
import {
  contextFor,
  createHarness,
  signedInUser,
  TEST_PASSWORD,
  uniqueEmployeeNumber,
} from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const tag = () => `tag-${crypto.randomUUID().slice(0, 8)}`;

/** 姓 / 名 with valid readings, for inputs that need a full name. */
const names = (lastName: string, firstName: string) => ({
  lastName,
  firstName,
  lastNameKana: "テスト",
  firstNameKana: "タロウ",
});

/** The query exactly as the router hands it to the service: parsed, defaults applied. */
const listQuery = (input: ListUsersInput) => listUsersSchema.parse(input);

/** A parsed 担当者 profile with a 社員番号 no other test uses. */
const profileInput = (overrides: Partial<UserProfileInput> = {}): UserProfileInput => ({
  employeeNumber: uniqueEmployeeNumber(),
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: null,
  areas: ["EAST"],
  regionCodes: [4],
  ...overrides,
});

/** The 社員番号 a user's profile holds. */
const employeeNumberOf = async (userId: string): Promise<number> =>
  (await h.db.userProfile.findUniqueOrThrow({ where: { userId } })).employeeNumber;

/**
 * Leaves only `keep` active among the admin roles: every other active admin-role user becomes
 * AM until the returned restore function puts each one's original role back. All API test
 * files share one database, so this is how a test reaches the last-admin boundary.
 */
const parkOtherAdmins = async (keep: string[]): Promise<() => Promise<void>> => {
  const parked = await h.db.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] }, deletedAt: null, id: { notIn: keep } },
    select: { id: true, role: true },
  });
  await h.db.user.updateMany({
    where: { id: { in: parked.map((u) => u.id) } },
    data: { role: "am" },
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
    const am = await signedInUser(h);
    const admin = await signedInUser(h, { role: "admin" });

    expect((await userService.getById(await contextFor(h, am.headers), am.user.id)).id).toBe(
      am.user.id,
    );
    expect((await userService.getById(await contextFor(h, admin.headers), am.user.id)).id).toBe(
      am.user.id,
    );
  });

  it("forbids an AM from reading other users", async () => {
    const am = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.getById(await contextFor(h, am.headers), other.user.id),
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

describe("getById: permission keys", () => {
  it("returns the user's effective permission keys", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);

    const detail = await userService.getById(await contextFor(h, admin.headers), am.user.id);

    expect(detail.permissionKeys).toEqual(await roleKeys("am"));
  });
});

describe("list", () => {
  it("returns only what the ability allows and filters by search/role", async () => {
    const marker = tag();
    const admin = await signedInUser(h, { role: "admin", name: "Admin Person" });
    const am = await signedInUser(h, { name: `Zed ${marker}` });

    const asAdmin = await userService.list(
      await contextFor(h, admin.headers),
      listQuery({ page: 1, perPage: 50, search: marker }),
    );
    expect(asAdmin.items.map((u) => u.id)).toEqual([am.user.id]);

    const asAm = await userService.list(
      await contextFor(h, am.headers),
      listQuery({ page: 1, perPage: 50 }),
    );
    expect(asAm.total).toBe(1);
    expect(asAm.items[0]?.id).toBe(am.user.id);

    const onlyAdmins = await userService.list(
      await contextFor(h, admin.headers),
      listQuery({ page: 1, perPage: 5, role: "admin" }),
    );
    expect(onlyAdmins.items.every((u) => u.role === "admin")).toBe(true);
  });

  it("finds a user by the katakana reading of the name", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const target = await signedInUser(h);
    const reading = `ヨミ${crypto
      .randomUUID()
      .replace(/[^a-f]/g, "")
      .slice(0, 4)
      .toUpperCase()}`;
    await userService.update(ctx, {
      userId: target.user.id,
      lastName: "読み",
      firstName: "検索",
      lastNameKana: "ヨミ",
      firstNameKana: "ケンサク",
    });
    await h.db.user.update({ where: { id: target.user.id }, data: { firstNameKana: reading } });

    const found = await userService.list(ctx, listQuery({ search: reading }));

    expect(found.items.map((u) => u.id)).toEqual([target.user.id]);
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
    const am = await signedInUser(h);

    const self = await userService.updateProfile(await contextFor(h, am.headers), {
      lastName: "自分",
      firstName: "改名",
    });
    expect(self).toMatchObject({ name: "自分 改名", lastName: "自分", firstName: "改名" });

    const byAdmin = await userService.updateProfile(await contextFor(h, admin.headers), {
      userId: am.user.id,
      ...names("管理", "改名"),
    });
    expect(byAdmin).toMatchObject({
      name: "管理 改名",
      lastNameKana: "テスト",
      firstNameKana: "タロウ",
    });
  });

  it("forbids an AM from editing other users", async () => {
    const am = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.updateProfile(await contextFor(h, am.headers), {
        userId: other.user.id,
        lastName: "不可",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

/** The catalog keys `permissions.csv` grants `role`, ascending. */
const roleKeys = async (role: string): Promise<string[]> =>
  (
    await h.db.rolePermission.findMany({
      where: { roleKey: role },
      select: { permissionKey: true },
      orderBy: { permissionKey: "asc" },
    })
  ).map((row) => row.permissionKey);

/** A user ALLOW row; grants are read at session lookup, so add it before building the context. */
const allow = (userId: string, ...keys: string[]) =>
  h.db.userPermission.createMany({
    data: keys.map((permissionKey) => ({ userId, permissionKey, effect: "ALLOW" as const })),
  });

describe("update", () => {
  it("lets anyone rename themselves without `changeRole`", async () => {
    const am = await signedInUser(h, { name: "Before" });

    const renamed = await userService.update(await contextFor(h, am.headers), {
      userId: am.user.id,
      ...names("後", "名前"),
    });

    expect(renamed).toMatchObject({ name: "後 名前", lastName: "後", firstName: "名前" });
    expect(renamed.role).toBe("am");
  });

  it("keeps the stored parts when only some change, and the display name follows", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const ctx = await contextFor(h, admin.headers);
    await userService.update(ctx, { userId: am.user.id, ...names("山田", "太郎") });

    const updated = await userService.update(ctx, {
      userId: am.user.id,
      firstName: "花子",
      firstNameKana: "ハナコ",
    });

    expect(updated).toMatchObject({
      name: "山田 花子",
      lastName: "山田",
      firstName: "花子",
      lastNameKana: "テスト",
      firstNameKana: "ハナコ",
    });
  });

  it("changes roles for callers holding `changeRole` and refuses to demote the last admin", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const adminCtx = await contextFor(h, admin.headers);

    await expect(
      userService.update(await contextFor(h, am.headers), {
        userId: am.user.id,
        role: "manager",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const promoted = await userService.update(adminCtx, { userId: am.user.id, role: "admin" });
    expect(promoted.role).toBe("admin");
    const demoted = await userService.update(adminCtx, { userId: am.user.id, role: "am" });
    expect(demoted.role).toBe("am");

    // Make `admin` the only active admin-role user, then try to demote them.
    const restore = await parkOtherAdmins([admin.user.id]);
    try {
      await expect(
        userService.update(adminCtx, { userId: admin.user.id, role: "am" }),
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
      const demoted = await userService.update(superAdminCtx, {
        userId: admin.user.id,
        role: "am",
      });
      expect(demoted.role).toBe("am");

      // The super_admin is now the last active admin-role user; their own role is not
      // assignable, so the role rule refuses before the last-admin rule is reached.
      await expect(
        userService.update(superAdminCtx, { userId: superAdmin.user.id, role: "manager" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect((await userService.getById(superAdminCtx, superAdmin.user.id)).role).toBe(
        "super_admin",
      );
    } finally {
      await restore();
    }
  });

  it("never assigns super_admin and leaves a super_admin's role alone", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const adminCtx = await contextFor(h, admin.headers);

    await expect(
      userService.update(adminCtx, { userId: am.user.id, role: "super_admin" }),
    ).rejects.toThrow("Not allowed to assign the role super_admin");
    await expect(
      userService.update(adminCtx, { userId: superAdmin.user.id, role: "admin" }),
    ).rejects.toThrow("Not allowed to change the role of a super_admin");
  });

  it("lets a manager holding `update` and `changeRole` hand out manager and AM only", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    await allow(manager.user.id, "1103", "1106");
    const ctx = await contextFor(h, manager.headers);
    const am = await signedInUser(h);
    const admin = await signedInUser(h, { role: "admin" });

    expect((await userService.update(ctx, { userId: am.user.id, role: "manager" })).role).toBe(
      "manager",
    );
    await expect(
      userService.update(ctx, { userId: am.user.id, role: "admin" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      userService.update(ctx, { userId: admin.user.id, role: "am" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("update: permission overrides", () => {
  it("stores what the selection adds (ALLOW) and removes (DENY), and the user's ability follows", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const manager = await signedInUser(h, { role: "manager" });
    const managerKeys = await roleKeys("manager");
    expect(managerKeys).toContain("1202");
    const selected = [...managerKeys.filter((key) => key !== "1202"), "1101"];

    const updated = await userService.update(await contextFor(h, admin.headers), {
      userId: manager.user.id,
      permissionKeys: selected,
    });

    expect(updated.permissionKeys).toEqual([...selected].sort());
    const rows = await h.db.userPermission.findMany({
      where: { userId: manager.user.id },
      select: { permissionKey: true, effect: true, assignedBy: true },
      orderBy: { permissionKey: "asc" },
    });
    expect(rows).toEqual([
      { permissionKey: "1101", effect: "ALLOW", assignedBy: admin.user.id },
      { permissionKey: "1202", effect: "DENY", assignedBy: admin.user.id },
    ]);
    const managerCtx = await contextFor(h, manager.headers);
    expect(managerCtx.ability.can("create", "User")).toBe(true);
    expect(managerCtx.ability.can("read", "Client")).toBe(false);
  });

  it("drops the overrides when the user leaves the manager role", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const manager = await signedInUser(h, { role: "manager" });
    const ctx = await contextFor(h, admin.headers);
    await userService.update(ctx, {
      userId: manager.user.id,
      permissionKeys: [...(await roleKeys("manager")), "1101"],
    });

    const demoted = await userService.update(ctx, { userId: manager.user.id, role: "am" });

    expect(await h.db.userPermission.count({ where: { userId: manager.user.id } })).toBe(0);
    expect(demoted.permissionKeys).toEqual(await roleKeys("am"));
  });

  it("refuses changes to the caller's own permissions", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    await allow(manager.user.id, "1103", "1106");

    await expect(
      userService.update(await contextFor(h, manager.headers), {
        userId: manager.user.id,
        permissionKeys: [...(await roleKeys("manager")), "1101"],
      }),
    ).rejects.toThrow("You cannot change your own permissions");
  });

  it("allows only permissions the caller holds", async () => {
    const actor = await signedInUser(h, { role: "manager" });
    await allow(actor.user.id, "1103", "1106");
    const ctx = await contextFor(h, actor.headers);
    const target = await signedInUser(h, { role: "manager" });
    const managerKeys = await roleKeys("manager");

    // 1201 (Client create) is not the actor's to give; 1103 is, through their own ALLOW row.
    await expect(
      userService.update(ctx, { userId: target.user.id, permissionKeys: [...managerKeys, "1201"] }),
    ).rejects.toThrow("Not allowed to grant permissions you do not hold: 1201");
    const updated = await userService.update(ctx, {
      userId: target.user.id,
      permissionKeys: [...managerKeys, "1103"],
    });
    expect(updated.permissionKeys).toContain("1103");
  });

  it("refuses overrides for a role without them, unknown keys, and callers without `changeRole`", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const manager = await signedInUser(h, { role: "manager" });
    const adminCtx = await contextFor(h, admin.headers);

    await expect(
      userService.update(adminCtx, { userId: am.user.id, permissionKeys: ["1101"] }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      userService.update(adminCtx, { userId: manager.user.id, permissionKeys: ["9999"] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      userService.update(await contextFor(h, am.headers), {
        userId: am.user.id,
        permissionKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.db.userPermission.count({ where: { userId: manager.user.id } })).toBe(0);
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
    // A user ALLOW row on 1105 gives this AM user `status User`; grants are read at session
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
    const am = await signedInUser(h);

    await expect(
      userService.deactivate(await contextFor(h, admin.headers), admin.user.id),
    ).rejects.toBeInstanceOf(ConflictError);

    const denied = userService.deactivate(await contextFor(h, am.headers), admin.user.id);
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
    const am = await signedInUser(h);
    const target = await signedInUser(h);
    await userService.deactivate(await contextFor(h, admin.headers), target.user.id);

    await expect(
      userService.reactivate(await contextFor(h, am.headers), target.user.id),
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
      lastName: "招待",
      firstName: "花子",
      lastNameKana: "ショウタイ",
      firstNameKana: "ハナコ",
      role: "manager",
    });

    expect(invited).toMatchObject({
      email,
      name: "招待 花子",
      lastName: "招待",
      firstName: "花子",
      lastNameKana: "ショウタイ",
      firstNameKana: "ハナコ",
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
        ...names("再度", "登録"),
        role: "am",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a role the caller may not give, before creating anyone", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const email = `${crypto.randomUUID()}@example.com`;

    await expect(
      userService.invite(await contextFor(h, admin.headers), {
        email,
        ...names("上司", "太郎"),
        role: "super_admin",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("writes the permission overrides of an invited manager", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const selected = [...(await roleKeys("manager")), "1101"];

    const invited = await userService.invite(await contextFor(h, admin.headers), {
      email: `${crypto.randomUUID()}@example.com`,
      ...names("権限", "付き"),
      role: "manager",
      permissionKeys: selected,
    });

    expect(invited.permissionKeys).toEqual([...selected].sort());
  });

  it("refuses overrides for a role without them, before creating anyone", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const email = `${crypto.randomUUID()}@example.com`;

    await expect(
      userService.invite(await contextFor(h, admin.headers), {
        email,
        ...names("権限", "無し"),
        role: "am",
        permissionKeys: ["1101"],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await h.db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("refuses a caller without `create User`", async () => {
    const am = await signedInUser(h);
    const email = `${crypto.randomUUID()}@example.com`;

    await expect(
      userService.invite(await contextFor(h, am.headers), {
        email,
        ...names("不可", "太郎"),
        role: "am",
      }),
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
    const invited = await userService.invite(ctx, {
      email,
      ...names("遅延", "太郎"),
      role: "am",
    });

    await userService.sendPasswordReset(ctx, invited.id);

    expect((await outboxFor(email)).map((row) => row.template)).toEqual([
      "account-invitation",
      "account-invitation",
    ]);
  });

  it("refuses a caller without `update User` on that user, and unknown or deactivated users", async () => {
    const am = await signedInUser(h);
    const other = await signedInUser(h);
    await expect(
      userService.sendPasswordReset(await contextFor(h, am.headers), other.user.id),
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

describe("担当者 profile (ADR 0007)", () => {
  it("invites a user with their profile and regions, and reads them back", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const profile = profileInput({
      retirementDate: "2027-03-31",
      areas: ["EAST", "WEST"],
      regionCodes: [4, 7],
    });

    const invited = await userService.invite(ctx, {
      email: `${crypto.randomUUID()}@example.com`,
      ...names("社員", "花子"),
      role: "am",
      profile,
    });

    expect(invited.profile).toMatchObject({
      employeeNumber: profile.employeeNumber,
      departmentName: "東日本営業部",
      position: "SV",
      retirementDate: new Date("2027-03-31"),
      areas: ["EAST", "WEST"],
    });
    expect(invited.profile?.regions.map((region) => region.regionCode)).toEqual([4, 7]);
    const read = await userService.getById(ctx, invited.id);
    expect(read.profile?.employeeNumber).toBe(profile.employeeNumber);
  });

  it("refuses a taken 社員番号 and an unknown region before creating anyone", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const holder = await signedInUser(h, { profile: {} });
    const taken = `${crypto.randomUUID()}@example.com`;
    const unknownRegion = `${crypto.randomUUID()}@example.com`;

    await expect(
      userService.invite(ctx, {
        email: taken,
        ...names("重複", "番号"),
        role: "am",
        profile: profileInput({ employeeNumber: await employeeNumberOf(holder.user.id) }),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      userService.invite(ctx, {
        email: unknownRegion,
        ...names("不明", "地域"),
        role: "am",
        profile: profileInput({ regionCodes: [99] }),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await h.db.user.count({ where: { email: { in: [taken, unknownRegion] } } })).toBe(0);
  });

  it("lets an admin give an existing user a profile and change it, never with another user's 社員番号", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const target = await signedInUser(h);
    const other = await signedInUser(h, { profile: {} });

    const given = await userService.update(ctx, {
      userId: target.user.id,
      profile: profileInput({ regionCodes: [3] }),
    });
    const changed = await userService.update(ctx, {
      userId: target.user.id,
      profile: profileInput({
        employeeNumber: given.profile!.employeeNumber,
        departmentName: "西日本営業部",
        position: "LEADER",
        areas: ["WEST"],
        regionCodes: [8, 7],
      }),
    });

    expect(changed.profile).toMatchObject({
      employeeNumber: given.profile!.employeeNumber,
      departmentName: "西日本営業部",
      position: "LEADER",
      areas: ["WEST"],
    });
    expect(changed.profile?.regions.map((region) => region.regionCode)).toEqual([7, 8]);
    await expect(
      userService.update(ctx, {
        userId: target.user.id,
        profile: profileInput({ employeeNumber: await employeeNumberOf(other.user.id) }),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lets an AM rename themselves but not change their own profile", async () => {
    const am = await signedInUser(h);
    const ctx = await contextFor(h, am.headers);

    await expect(
      userService.update(ctx, { userId: am.user.id, profile: profileInput() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.db.userProfile.count({ where: { userId: am.user.id } })).toBe(0);
    const renamed = await userService.update(ctx, { userId: am.user.id, ...names("自分", "名前") });
    expect(renamed.name).toBe("自分 名前");
  });

  it("filters the list by area, region and position, and finds a user by 社員番号", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const marker = tag();
    const east = await signedInUser(h, {
      name: `${marker} East`,
      profile: { areas: ["EAST"], position: "SV", regionCodes: [4] },
    });
    const west = await signedInUser(h, {
      name: `${marker} West`,
      profile: { areas: ["WEST"], position: "LEADER", regionCodes: [7] },
    });
    await signedInUser(h, { name: `${marker} None` });
    const ids = async (input: ListUsersInput) =>
      (await userService.list(ctx, listQuery({ search: marker, ...input }))).items
        .map((user) => user.id)
        .sort();

    expect(await ids({ areas: ["WEST"] })).toEqual([west.user.id]);
    expect(await ids({ regionCodes: [4] })).toEqual([east.user.id]);
    expect(await ids({ positions: ["SV", "LEADER"] })).toEqual([east.user.id, west.user.id].sort());
    const byNumber = await userService.list(
      ctx,
      listQuery({ search: String(await employeeNumberOf(east.user.id)) }),
    );
    expect(byNumber.items.map((user) => user.id)).toContain(east.user.id);
    expect(byNumber.items.map((user) => user.id)).not.toContain(west.user.id);
    expect(byNumber.items.find((user) => user.id === east.user.id)?.profile?.regions).toHaveLength(
      1,
    );
  });

  it("sorts by 社員番号, users without a profile last", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const marker = tag();
    const base = uniqueEmployeeNumber();
    const second = await signedInUser(h, {
      name: `${marker} b`,
      profile: { employeeNumber: base + 2 },
    });
    const first = await signedInUser(h, {
      name: `${marker} a`,
      profile: { employeeNumber: base + 1 },
    });
    const none = await signedInUser(h, { name: `${marker} c` });

    const page = await userService.list(
      ctx,
      listQuery({ search: marker, sortBy: "employeeNumber", sortOrder: "asc" }),
    );

    expect(page.items.map((user) => user.id)).toEqual([
      first.user.id,
      second.user.id,
      none.user.id,
    ]);
  });

  it("offers as 担当者 the active users of the regions in kana order, never a super_admin", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const withKana = async (
      lastNameKana: string,
      firstNameKana: string,
      options: Parameters<typeof signedInUser>[1] = {},
    ) => {
      const signedIn = await signedInUser(h, { profile: { regionCodes: [9] }, ...options });
      await h.db.user.update({
        where: { id: signedIn.user.id },
        data: { lastNameKana, firstNameKana },
      });
      return signedIn.user.id;
    };
    const yamada = await withKana("ヤマダ", "タロウ");
    const abe = await withKana("アベ", "ハナコ");
    const superAdmin = await withKana("アアア", "アア", { role: "super_admin" });
    const gone = await withKana("イイダ", "ジロウ");
    await h.db.user.update({ where: { id: gone }, data: { deletedAt: new Date() } });
    const elsewhere = await withKana("イシイ", "サブロウ", { profile: { regionCodes: [8] } });
    const mine = new Set([yamada, abe, superAdmin, gone, elsewhere]);

    const options = await userService.chargerOptions(ctx, { regionCodes: [9] });

    expect(options.map((option) => option.id).filter((id) => mine.has(id))).toEqual([abe, yamada]);
  });

  it("tells an admin whether a 社員番号 is free, and refuses an AM", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const holder = await signedInUser(h, { profile: {} });
    const employeeNumber = await employeeNumberOf(holder.user.id);
    const ctx = await contextFor(h, admin.headers);

    expect(await userService.isEmployeeNumberAvailable(ctx, { employeeNumber })).toBe(false);
    expect(
      await userService.isEmployeeNumberAvailable(ctx, {
        employeeNumber,
        excludeUserId: holder.user.id,
      }),
    ).toBe(true);
    await expect(
      userService.isEmployeeNumberAvailable(await contextFor(h, am.headers), { employeeNumber }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

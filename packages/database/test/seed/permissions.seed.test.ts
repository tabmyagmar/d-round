import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedPermissions } from "../../prisma/seed/permissions.seed";
import { seedRoles } from "../../prisma/seed/roles.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// The roles test runs seedRoles on the shared container in parallel and briefly renames
// `manager`, so role names and seedRoles's summary are not asserted here. No other file commits
// permissions or grants (permission.repository.test.ts writes them only inside rolled-back
// transactions), so their counts and seedPermissions's summary are exact.

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const seedRolesAndPermissions = async () => {
  await seedRoles(prisma);
  return seedPermissions(prisma);
};

const UNCHANGED = {
  dataset: "permissions",
  rows: 43,
  created: 0,
  updated: 0,
  skipped: 0,
  grants: { created: 0, deleted: 0 },
};

const findPermissions = () =>
  prisma.permission.findMany({ include: { parent: true }, orderBy: { key: "asc" } });

const findGrants = () =>
  prisma.rolePermission.findMany({ orderBy: [{ roleKey: "asc" }, { permissionKey: "asc" }] });

const rolesGranted = async (permissionKey: string): Promise<string[]> => {
  const grants = await prisma.rolePermission.findMany({
    where: { permissionKey },
    orderBy: { roleKey: "asc" },
  });
  return grants.map((grant) => grant.roleKey);
};

const grantOf = (roleKey: string, permissionKey: string) =>
  prisma.rolePermission.findUnique({
    where: { roleKey_permissionKey: { roleKey, permissionKey } },
  });

describe("seedPermissions", () => {
  it("loads the 43 catalog permissions: 8 parents and 35 children linked by key", async () => {
    const summary = await seedRolesAndPermissions();

    expect(summary).toMatchObject({ dataset: "permissions", rows: 43, skipped: 0 });
    const permissions = await findPermissions();
    expect(permissions).toHaveLength(43);
    const parents = permissions.filter((permission) => permission.parentKey === null);
    expect(parents.map((parent) => parent.key)).toEqual([
      "1100",
      "1200",
      "1300",
      "1400",
      "1500",
      "1600",
      "1700",
      "1800",
    ]);
    expect(parents.filter((parent) => parent.action !== "all")).toEqual([]);
    const children = permissions.filter((permission) => permission.parentKey !== null);
    expect(children).toHaveLength(35);
    expect(children.filter((child) => child.parent?.key !== child.parentKey)).toEqual([]);
    expect(permissions.find((permission) => permission.key === "1101")).toMatchObject({
      name: "User create",
      nameJp: "担当者新規登録",
      parentKey: "1100",
      action: "create",
      subject: "Admin_User",
      modelName: "User",
      visible: true,
    });
    // Our own row (not legacy data): the `changeRole` CASL action, see ADR 0005.
    expect(permissions.find((permission) => permission.key === "1106")).toMatchObject({
      name: "User role",
      nameJp: "担当者の役割変更",
      parentKey: "1100",
      action: "changeRole",
      subject: "Admin_User",
      modelName: "User",
      visible: true,
    });
    expect(permissions.filter((permission) => !permission.visible)).toEqual([]);
  });

  it("grants each role exactly the permissions flagged in its CSV column", async () => {
    await seedRolesAndPermissions();

    expect(await prisma.rolePermission.count()).toBe(88);
    const grants = await findGrants();
    const perRole: Record<string, number> = {};
    for (const { roleKey } of grants) {
      perRole[roleKey] = (perRole[roleKey] ?? 0) + 1;
    }
    expect(perRole).toEqual({ super_admin: 35, admin: 35, manager: 10, staff: 8 });
    expect(await rolesGranted("1202")).toEqual(["admin", "manager", "staff", "super_admin"]);
    expect(await rolesGranted("1101")).toEqual(["admin", "super_admin"]);
    expect(await rolesGranted("1106")).toEqual(["admin", "super_admin"]);
    expect(await rolesGranted("1100")).toEqual([]);
    expect(await rolesGranted("1401")).toEqual(["admin", "manager", "super_admin"]);
  });

  it("syncs role grants to the CSV: removes a stale grant and restores a missing one", async () => {
    await seedRolesAndPermissions();
    await prisma.rolePermission.create({ data: { roleKey: "staff", permissionKey: "1101" } });
    await prisma.rolePermission.delete({
      where: { roleKey_permissionKey: { roleKey: "manager", permissionKey: "1202" } },
    });

    const summary = await seedPermissions(prisma);

    expect(summary).toEqual({ ...UNCHANGED, grants: { created: 1, deleted: 1 } });
    expect(await grantOf("staff", "1101")).toBeNull();
    expect(await grantOf("manager", "1202")).not.toBeNull();
    expect(await prisma.rolePermission.count()).toBe(88);
  });

  it("never touches a user's own permission grants", async () => {
    await seedRolesAndPermissions();
    const user = await prisma.user.create({
      data: { name: "Permission Seed Test", email: `${crypto.randomUUID()}@example.com` },
    });
    const userGrant = await prisma.userPermission.create({
      data: { userId: user.id, permissionKey: "1202" },
    });

    await seedPermissions(prisma);

    expect(
      await prisma.userPermission.findUnique({
        where: { userId_permissionKey: { userId: user.id, permissionKey: "1202" } },
      }),
    ).toEqual(userGrant);
  });

  it("keeps a permission that is not in the CSV and its role grants", async () => {
    await seedRolesAndPermissions();
    const suffix = crypto.randomUUID();
    const runtimeKey = `runtime-${suffix}`;
    try {
      await prisma.permission.create({
        data: {
          key: runtimeKey,
          name: "Runtime permission",
          nameJp: "ランタイム権限",
          action: "read",
          subject: `Runtime_${suffix}`,
          modelName: "Runtime",
        },
      });
      await prisma.rolePermission.create({ data: { roleKey: "staff", permissionKey: runtimeKey } });

      const summary = await seedPermissions(prisma);

      expect(summary).toEqual(UNCHANGED);
      expect(await prisma.permission.findUnique({ where: { key: runtimeKey } })).not.toBeNull();
      expect(await grantOf("staff", runtimeKey)).not.toBeNull();
    } finally {
      // Other tests count exactly 43 permissions; the delete cascades to the runtime grant.
      await prisma.permission.deleteMany({ where: { key: runtimeKey } });
    }
  });

  it("restores a permission whose values drifted from the CSV without creating rows", async () => {
    await seedRolesAndPermissions();
    await prisma.permission.update({
      where: { key: "1101" },
      data: { name: "stale", nameJp: "stale", parentKey: "1200", action: "stale" },
    });

    const summary = await seedPermissions(prisma);

    expect(summary).toEqual({ ...UNCHANGED, updated: 1 });
    expect(await prisma.permission.count()).toBe(43);
    expect(await prisma.permission.findUniqueOrThrow({ where: { key: "1101" } })).toMatchObject({
      name: "User create",
      nameJp: "担当者新規登録",
      parentKey: "1100",
      action: "create",
    });
  });

  it("restores a permission whose visible flag drifted from the CSV", async () => {
    await seedRolesAndPermissions();
    await prisma.permission.update({ where: { key: "1106" }, data: { visible: false } });

    const summary = await seedPermissions(prisma);

    expect(summary).toEqual({ ...UNCHANGED, updated: 1 });
    expect(await prisma.permission.count()).toBe(43);
    expect(await prisma.permission.findUniqueOrThrow({ where: { key: "1106" } })).toMatchObject({
      visible: true,
    });
  });

  it("changes nothing on a second run", async () => {
    await seedRolesAndPermissions();
    const permissionsBefore = await findPermissions();
    const grantsBefore = await findGrants();

    const summary = await seedPermissions(prisma);

    expect(summary).toEqual(UNCHANGED);
    const permissionsAfter = await findPermissions();
    expect(permissionsAfter.map((permission) => [permission.key, permission.updatedAt])).toEqual(
      permissionsBefore.map((permission) => [permission.key, permission.updatedAt]),
    );
    expect(await findGrants()).toEqual(grantsBefore);
  });
});

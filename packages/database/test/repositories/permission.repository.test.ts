import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createPermissionRepository } from "../../src/repositories/permission.repository";
import type { EffectiveGrant } from "../../src/repositories/permission.repository";
import type { TransactionClient } from "../../src/utils/transaction";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Thrown at the end of every scenario so the transaction rolls back and nothing persists. */
const ROLLBACK = new Error("rollback: scenario finished");

/**
 * Runs a scenario inside a transaction that is always rolled back. The seed tests run in parallel
 * on the same container and assert exact catalog counts (roles, permissions, grants), so no
 * permission, grant or user created here may ever become visible to them.
 */
const inRolledBackTransaction = async (
  scenario: (tx: TransactionClient) => Promise<void>,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      await scenario(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) {
      throw error;
    }
  }
};

/** Unique key prefix per scenario; assertions filter on it because catalog rows share the tables. */
const newPrefix = () => `rt-${crypto.randomUUID()}`;

type PermissionOverrides = { action?: string; modelName?: string; visible?: boolean };

/** A runtime permission with a unique `key`; `subject` mirrors it so `@@unique([action, subject])` holds. */
const createPermission = (
  tx: TransactionClient,
  key: string,
  overrides: PermissionOverrides = {},
): Promise<EffectiveGrant> =>
  tx.permission.create({
    data: {
      key,
      name: `Runtime ${key}`,
      nameJp: "ランタイム権限",
      action: "read",
      subject: key,
      modelName: "Runtime",
      ...overrides,
    },
    select: { key: true, action: true, modelName: true },
  });

const createUser = (tx: TransactionClient) =>
  tx.user.create({
    data: {
      name: "Permission repository user",
      email: `${crypto.randomUUID()}@example.com`,
      role: "am",
    },
  });

const grantToRole = (tx: TransactionClient, roleKey: string, ...keys: string[]) =>
  tx.rolePermission.createMany({
    data: keys.map((permissionKey) => ({ roleKey, permissionKey })),
  });

const mine = (prefix: string, rows: EffectiveGrant[]) =>
  rows.filter((row) => row.key.startsWith(prefix));

const ROLE = "manager";

describe("permission repository", () => {
  describe("findEffectiveGrants", () => {
    it("returns the role's grants ordered by key with action and modelName", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const c = await createPermission(tx, `${prefix}-c`, {
          action: "update",
          modelName: "Task",
        });
        const a = await createPermission(tx, `${prefix}-a`);
        await createPermission(tx, `${prefix}-b`);
        await grantToRole(tx, ROLE, c.key, a.key);
        const user = await createUser(tx);

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([
          { key: a.key, action: "read", modelName: "Runtime" },
          { key: c.key, action: "update", modelName: "Task" },
        ]);
      });
    });

    it("adds a user's ALLOW row for a permission the role does not grant", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const b = await createPermission(tx, `${prefix}-b`);
        await grantToRole(tx, ROLE, a.key);
        const user = await createUser(tx);
        await tx.userPermission.create({
          data: { userId: user.id, permissionKey: b.key, effect: "ALLOW" },
        });

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([a, b]);
      });
    });

    it("removes a role grant the user has a DENY row for", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const b = await createPermission(tx, `${prefix}-b`);
        await grantToRole(tx, ROLE, a.key, b.key);
        const user = await createUser(tx);
        await tx.userPermission.create({
          data: { userId: user.id, permissionKey: a.key, effect: "DENY" },
        });

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([b]);
      });
    });

    it("ignores a DENY row for a permission the role does not grant", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const b = await createPermission(tx, `${prefix}-b`);
        await grantToRole(tx, ROLE, a.key);
        const user = await createUser(tx);
        await tx.userPermission.create({
          data: { userId: user.id, permissionKey: b.key, effect: "DENY" },
        });

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([a]);
      });
    });

    it("treats a user row created without effect as ALLOW", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const user = await createUser(tx);
        await tx.userPermission.create({ data: { userId: user.id, permissionKey: a.key } });

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([a]);
      });
    });

    it("returns an invisible permission too: visible is not an authorization input", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const hidden = await createPermission(tx, `${prefix}-hidden`, { visible: false });
        await grantToRole(tx, ROLE, hidden.key);
        const user = await createUser(tx);

        const grants = await createPermissionRepository(tx).findEffectiveGrants(user.id, ROLE);

        expect(mine(prefix, grants)).toEqual([hidden]);
      });
    });

    it("applies only the user's own ALLOW and DENY rows", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const b = await createPermission(tx, `${prefix}-b`);
        await grantToRole(tx, ROLE, a.key);
        const denied = await createUser(tx);
        const allowed = await createUser(tx);
        await tx.userPermission.create({
          data: { userId: denied.id, permissionKey: a.key, effect: "DENY" },
        });
        await tx.userPermission.create({
          data: { userId: allowed.id, permissionKey: b.key, effect: "ALLOW" },
        });
        const repo = createPermissionRepository(tx);

        expect(mine(prefix, await repo.findEffectiveGrants(denied.id, ROLE))).toEqual([]);
        expect(mine(prefix, await repo.findEffectiveGrants(allowed.id, ROLE))).toEqual([a, b]);
      });
    });

    it("returns nothing for a role without grants or an unknown role", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        await grantToRole(tx, ROLE, a.key);
        const user = await createUser(tx);
        const repo = createPermissionRepository(tx);

        // `am` exists but holds none of this scenario's permissions.
        expect(mine(prefix, await repo.findEffectiveGrants(user.id, "am"))).toEqual([]);
        // An unknown role has no grants at all, and the user has no rows: the full result is empty.
        expect(await repo.findEffectiveGrants(user.id, `no-such-role-${prefix}`)).toEqual([]);
      });
    });
  });

  describe("findVisibleCatalog", () => {
    it("returns visible rows in key order with the roles that hold each one", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        await createPermission(tx, `${prefix}-b`);
        await createPermission(tx, `${prefix}-a`, { action: "all" });
        await createPermission(tx, `${prefix}-hidden`, { visible: false });
        await tx.permission.update({
          where: { key: `${prefix}-b` },
          data: { parentKey: `${prefix}-a` },
        });
        await grantToRole(tx, "am", `${prefix}-b`);
        await grantToRole(tx, "admin", `${prefix}-b`);

        const catalog = await createPermissionRepository(tx).findVisibleCatalog();

        expect(catalog.filter((row) => row.key.startsWith(prefix))).toEqual([
          {
            key: `${prefix}-a`,
            name: `Runtime ${prefix}-a`,
            nameJp: "ランタイム権限",
            parentKey: null,
            action: "all",
            modelName: "Runtime",
            roles: [],
          },
          {
            key: `${prefix}-b`,
            name: `Runtime ${prefix}-b`,
            nameJp: "ランタイム権限",
            parentKey: `${prefix}-a`,
            action: "read",
            modelName: "Runtime",
            roles: [{ roleKey: "admin" }, { roleKey: "am" }],
          },
        ]);
      });
    });
  });

  describe("user overrides", () => {
    it("replaces a user's rows instead of adding to them, and reads them back in key order", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const b = await createPermission(tx, `${prefix}-b`);
        const c = await createPermission(tx, `${prefix}-c`);
        const user = await createUser(tx);
        const other = await createUser(tx);
        const repo = createPermissionRepository(tx);
        await repo.replaceUserOverrides(
          other.id,
          [{ permissionKey: a.key, effect: "ALLOW" }],
          null,
        );
        await repo.replaceUserOverrides(user.id, [{ permissionKey: a.key, effect: "ALLOW" }], null);

        const written = await repo.replaceUserOverrides(
          user.id,
          [
            { permissionKey: c.key, effect: "DENY" },
            { permissionKey: b.key, effect: "ALLOW" },
          ],
          other.id,
        );

        expect(written).toBe(2);
        expect(await repo.findUserOverrides(user.id)).toEqual([
          { permissionKey: b.key, effect: "ALLOW" },
          { permissionKey: c.key, effect: "DENY" },
        ]);
        expect(await repo.findUserOverrides(other.id)).toEqual([
          { permissionKey: a.key, effect: "ALLOW" },
        ]);
        const stored = await tx.userPermission.findFirstOrThrow({
          where: { userId: user.id, permissionKey: b.key },
        });
        expect(stored.assignedBy).toBe(other.id);
      });
    });

    it("clears every row of the user when given none", async () => {
      await inRolledBackTransaction(async (tx) => {
        const prefix = newPrefix();
        const a = await createPermission(tx, `${prefix}-a`);
        const user = await createUser(tx);
        const repo = createPermissionRepository(tx);
        await repo.replaceUserOverrides(user.id, [{ permissionKey: a.key, effect: "DENY" }], null);

        expect(await repo.replaceUserOverrides(user.id, [], null)).toBe(0);
        expect(await repo.findUserOverrides(user.id)).toEqual([]);
      });
    });
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedRoles } from "../../prisma/seed/roles.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// The permissions test seeds the same roles on the shared container in parallel, so the first
// run's created/updated split is not asserted, only the data it leaves behind and that a re-run
// changes nothing. No test deletes a role: the delete would cascade to that test's grants.

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const findRoles = () => prisma.role.findMany({ orderBy: { key: "asc" } });

describe("seedRoles", () => {
  it("loads the four catalog roles with lower-case keys", async () => {
    const summary = await seedRoles(prisma);

    expect(summary).toMatchObject({ dataset: "roles", rows: 4, skipped: 0 });
    const roles = await findRoles();
    expect(roles.map(({ key, name, nameJp }) => ({ key, name, nameJp }))).toEqual([
      { key: "admin", name: "Admin", nameJp: "アドミン" },
      { key: "am", name: "AM", nameJp: "AM" },
      { key: "manager", name: "Manager", nameJp: "マネジャー" },
      { key: "super_admin", name: "Super admin", nameJp: "スーパーアドミン" },
    ]);
  });

  it("changes nothing on a second run", async () => {
    await seedRoles(prisma);
    const before = await findRoles();

    const summary = await seedRoles(prisma);

    expect(summary).toEqual({ dataset: "roles", rows: 4, created: 0, updated: 0, skipped: 0 });
    const after = await findRoles();
    expect(after).toHaveLength(4);
    expect(after.map((role) => [role.key, role.updatedAt])).toEqual(
      before.map((role) => [role.key, role.updatedAt]),
    );
  });

  it("restores a role whose names drifted, in place, leaving the other roles untouched", async () => {
    await seedRoles(prisma);
    const before = await findRoles();
    const drifted = await prisma.role.update({
      where: { key: "manager" },
      data: { name: "stale", nameJp: "stale" },
    });

    const summary = await seedRoles(prisma);

    expect(summary.created).toBe(0);
    expect(await prisma.role.count()).toBe(4);
    expect(await prisma.role.findUniqueOrThrow({ where: { key: "manager" } })).toMatchObject({
      id: drifted.id,
      name: "Manager",
      nameJp: "マネジャー",
    });
    const others = (roles: typeof before) =>
      roles.filter((role) => role.key !== "manager").map((role) => [role.key, role.updatedAt]);
    expect(others(await findRoles())).toEqual(others(before));
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createUserRepository } from "../../src/repositories/user.repository";
import type { DbClient } from "../../src/utils/transaction";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Each test gets its own name prefix so it can scope queries to the rows it created. */
const group = () => `group-${crypto.randomUUID()}`;

const createUser = (
  data: { group: string; role?: string; index?: number },
  db: DbClient = prisma,
) =>
  db.user.create({
    data: {
      name: `${data.group} ${String(data.index ?? 0)}`,
      email: `${crypto.randomUUID()}@example.com`,
      role: data.role ?? "staff",
    },
  });

const inGroup = (prefix: string) => ({ name: { startsWith: prefix } });

describe("user repository", () => {
  it("excludes soft-deleted users from reads and counts", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    const active = await createUser({ group: prefix });
    const gone = await createUser({ group: prefix });

    await repo.softDelete(gone.id);

    expect(await repo.findById(gone.id)).toBeNull();
    expect((await repo.findByIdIncludingDeleted(gone.id))?.banned).toBe(true);
    expect((await repo.findById(active.id))?.id).toBe(active.id);
    expect(await repo.count(inGroup(prefix))).toBe(1);
    const page = await repo.findMany({ page: 1, perPage: 10 }, inGroup(prefix));
    expect(page.items.map((u) => u.id)).toEqual([active.id]);
  });

  it("paginates newest first and reports totals", async () => {
    const repo = createUserRepository(prisma);
    const prefix = group();
    for (let i = 0; i < 3; i += 1) {
      await createUser({ group: prefix, index: i });
    }

    const first = await repo.findMany({ page: 1, perPage: 2 }, inGroup(prefix));
    const second = await repo.findMany({ page: 2, perPage: 2 }, inGroup(prefix));

    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(first.hasNext).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasPrev).toBe(true);
    expect(first.items[0]?.name).toBe(`${prefix} 2`);
  });

  it("counts active users of the given admin roles only", async () => {
    // The count is global and other test files create admins in parallel: a RepeatableRead
    // snapshot makes the before/after delta see only the rows this transaction writes.
    await prisma.$transaction(
      async (tx) => {
        const repo = createUserRepository(tx);
        const prefix = group();
        const bothBefore = await repo.countActiveAdmins(["super_admin", "admin"]);
        const adminBefore = await repo.countActiveAdmins(["admin"]);

        await createUser({ group: prefix, role: "super_admin" }, tx);
        await createUser({ group: prefix, role: "admin" }, tx);
        await createUser({ group: prefix, role: "staff" }, tx);
        const gone = await createUser({ group: prefix, role: "admin" }, tx);
        await repo.softDelete(gone.id);

        expect(await repo.countActiveAdmins(["super_admin", "admin"])).toBe(bothBefore + 2);
        expect(await repo.countActiveAdmins(["admin"])).toBe(adminBefore + 1);
      },
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("updates profile fields and role independently", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ group: group() });

    const updated = await repo.updateProfile(user.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.role).toBe("staff");

    const promoted = await repo.updateRole(user.id, "admin");
    expect(promoted.role).toBe("admin");
    expect(promoted.name).toBe("Renamed");
  });
});

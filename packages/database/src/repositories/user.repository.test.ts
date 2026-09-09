import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../client";
import type { PrismaClient } from "../client";

import { createUserRepository } from "./user.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const department = () => `dept-${crypto.randomUUID()}`;

const createUser = (data: { department: string; role?: string; name?: string }) =>
  prisma.user.create({
    data: {
      name: data.name ?? "Test User",
      email: `${crypto.randomUUID()}@example.com`,
      role: data.role ?? "member",
      department: data.department,
    },
  });

describe("user repository", () => {
  it("excludes soft-deleted users from reads and counts", async () => {
    const repo = createUserRepository(prisma);
    const dept = department();
    const active = await createUser({ department: dept });
    const gone = await createUser({ department: dept });

    await repo.softDelete(gone.id);

    expect(await repo.findById(gone.id)).toBeNull();
    expect((await repo.findByIdIncludingDeleted(gone.id))?.banned).toBe(true);
    expect((await repo.findById(active.id))?.id).toBe(active.id);
    expect(await repo.count({ department: dept })).toBe(1);
    const page = await repo.findMany({ page: 1, perPage: 10 }, { department: dept });
    expect(page.items.map((u) => u.id)).toEqual([active.id]);
  });

  it("paginates newest first and reports totals", async () => {
    const repo = createUserRepository(prisma);
    const dept = department();
    for (let i = 0; i < 3; i += 1) {
      await createUser({ department: dept, name: `User ${String(i)}` });
    }

    const first = await repo.findMany({ page: 1, perPage: 2 }, { department: dept });
    const second = await repo.findMany({ page: 2, perPage: 2 }, { department: dept });

    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(first.hasNext).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.hasPrev).toBe(true);
    expect(first.items[0]?.name).toBe("User 2");
  });

  it("updates profile fields and role independently", async () => {
    const repo = createUserRepository(prisma);
    const user = await createUser({ department: department() });

    const updated = await repo.updateProfile(user.id, { name: "Renamed", employeeCode: null });
    expect(updated.name).toBe("Renamed");
    expect(updated.role).toBe("member");

    const promoted = await repo.updateRole(user.id, "hr_manager");
    expect(promoted.role).toBe("hr_manager");
    expect(promoted.name).toBe("Renamed");
  });
});

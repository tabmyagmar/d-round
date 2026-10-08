import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createCommentTemplateRepository } from "../../src/repositories/comment-template.repository";
import type { CommentTemplateCreate } from "../../src/repositories/comment-template.repository";
import { isUniqueViolation } from "../../src/utils/errors";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A fresh owner per test: every query below is scoped to it, so tests never see each other. */
const createOwner = () =>
  prisma.user.create({
    data: {
      name: "Comment template owner",
      email: `${crypto.randomUUID()}@example.com`,
      role: "am",
    },
  });

const template = (
  createdBy: string,
  short: string,
  overrides: Partial<CommentTemplateCreate> = {},
): CommentTemplateCreate => ({
  createdBy,
  short,
  content: `${short}の本文`,
  types: ["WORKFLOW"],
  ...overrides,
});

describe("comment template repository", () => {
  it("creates a template with its menus and finds it by id", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();

    const created = await repo.create(
      template(owner.id, "承認", { types: ["WORKFLOW", "STAFF"], content: "承認します。" }),
    );

    expect(await repo.findById(created.id)).toMatchObject({
      createdBy: owner.id,
      short: "承認",
      content: "承認します。",
      types: ["WORKFLOW", "STAFF"],
    });
    expect(await repo.findById(crypto.randomUUID())).toBeNull();
  });

  it("pages the rows the where selects, newest first, with totals", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const other = await createOwner();
    const first = await repo.create(template(owner.id, "一"));
    const second = await repo.create(template(owner.id, "二"));
    const third = await repo.create(template(owner.id, "三"));
    await repo.create(template(other.id, "四"));

    const page1 = await repo.findMany({ page: 1, perPage: 2 }, { createdBy: owner.id });
    const page2 = await repo.findMany({ page: 2, perPage: 2 }, { createdBy: owner.id });

    expect(page1.items.map((row) => row.id)).toEqual([third.id, second.id]);
    expect(page2.items.map((row) => row.id)).toEqual([first.id]);
    expect(page1).toMatchObject({ total: 3, totalPages: 2, hasNext: true });
  });

  it("selects the templates offered in one menu", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const client = await repo.create(template(owner.id, "顧客", { types: ["CLIENT", "STAFF"] }));
    await repo.create(template(owner.id, "承認", { types: ["WORKFLOW"] }));

    const page = await repo.findMany(
      { page: 1, perPage: 10 },
      { createdBy: owner.id, types: { has: "CLIENT" } },
    );

    expect(page.items.map((row) => row.id)).toEqual([client.id]);
  });

  it("refuses a second template with the same title for one owner, not for another owner", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const other = await createOwner();
    await repo.create(template(owner.id, "同じ"));

    await expect(repo.create(template(owner.id, "同じ"))).rejects.toSatisfy(isUniqueViolation);
    await expect(repo.create(template(other.id, "同じ"))).resolves.toMatchObject({
      createdBy: other.id,
    });
  });

  it("updates only the fields it is given", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const created = await repo.create(template(owner.id, "旧", { types: ["CLIENT"] }));

    const updated = await repo.update(created.id, { short: "新" });

    expect(updated).toMatchObject({ short: "新", content: "旧の本文", types: ["CLIENT"] });
  });

  it("deletes exactly the rows the where selects and returns their count", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const other = await createOwner();
    const gone = await repo.create(template(owner.id, "消す"));
    const kept = await repo.create(template(owner.id, "残す"));
    const othersRow = await repo.create(template(other.id, "他人"));

    const count = await repo.deleteMany({
      createdBy: owner.id,
      id: { in: [gone.id, othersRow.id] },
    });

    expect(count).toBe(1);
    expect(await repo.findById(gone.id)).toBeNull();
    expect(await repo.findById(kept.id)).not.toBeNull();
    expect(await repo.findById(othersRow.id)).not.toBeNull();
  });

  it("removes a user's templates with the user", async () => {
    const repo = createCommentTemplateRepository(prisma);
    const owner = await createOwner();
    const created = await repo.create(template(owner.id, "所有者と共に"));

    await prisma.user.delete({ where: { id: owner.id } });

    expect(await repo.findById(created.id)).toBeNull();
  });
});

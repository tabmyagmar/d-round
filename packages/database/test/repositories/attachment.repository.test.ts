import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import type { AttachmentKind } from "../../src/generated/prisma/client";
import { createAttachmentRepository } from "../../src/repositories/attachment.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createUser = () =>
  prisma.user.create({ data: { name: "添付 太郎", email: `${crypto.randomUUID()}@example.com` } });

const createStaff = () =>
  prisma.staff.create({
    data: {
      employeeType: "FULL_TIME",
      employeeNumber: 10_000 + Math.floor(Math.random() * 1_000_000_000),
      lastName: "添付",
      firstName: "花子",
      lastNameKana: "テンプ",
      firstNameKana: "ハナコ",
      gender: "FEMALE",
    },
  });

const pending = (uploadedById: string, kind: AttachmentKind = "STAFF_RESUME") =>
  createAttachmentRepository(prisma).create({
    kind,
    objectKey: `resumes/${crypto.randomUUID()}.pdf`,
    fileName: "履歴書.pdf",
    contentType: "application/pdf",
    size: 1024,
    uploadedById,
  });

describe("attachment repository", () => {
  it("creates PENDING rows and attaches only the uploader's pending rows of the kind", async () => {
    const repo = createAttachmentRepository(prisma);
    const uploader = await createUser();
    const other = await createUser();
    const staff = await createStaff();
    const first = await pending(uploader.id);
    const second = await pending(uploader.id);
    const foreign = await pending(other.id);
    const avatar = await pending(uploader.id, "USER_AVATAR");

    expect(first).toMatchObject({
      status: "PENDING",
      userId: null,
      staffId: null,
      attachedAt: null,
    });

    const moved = await repo.attach([first.id, second.id, foreign.id, avatar.id], {
      uploadedById: uploader.id,
      kind: "STAFF_RESUME",
      owner: { staffId: staff.id },
    });

    expect(moved).toBe(2);
    const attached = await repo.findAttached({ staffId: staff.id }, "STAFF_RESUME");
    expect(attached.map((row) => row.id)).toEqual([first.id, second.id]);
    expect(attached[0]).toMatchObject({ status: "ATTACHED", staffId: staff.id });
    expect(attached[0]?.attachedAt).toBeInstanceOf(Date);
    expect((await repo.findById(foreign.id))?.status).toBe("PENDING");
    expect(
      await repo.attach([first.id], {
        uploadedById: uploader.id,
        kind: "STAFF_RESUME",
        owner: { staffId: staff.id },
      }),
    ).toBe(0);
  });

  it("marks rows DELETED only from the expected status", async () => {
    const repo = createAttachmentRepository(prisma);
    const uploader = await createUser();
    const owned = await pending(uploader.id, "USER_AVATAR");
    await repo.attach([owned.id], {
      uploadedById: uploader.id,
      kind: "USER_AVATAR",
      owner: { userId: uploader.id },
    });
    const stale = await pending(uploader.id);

    // The sweeper expires PENDING rows: an attached row in the same list stays attached.
    expect(await repo.markDeleted([owned.id, stale.id], "PENDING")).toBe(1);
    expect((await repo.findById(owned.id))?.status).toBe("ATTACHED");
    const expired = await repo.findById(stale.id);
    expect(expired?.status).toBe("DELETED");
    expect(expired?.deletedAt).toBeInstanceOf(Date);

    expect(await repo.markDeleted([owned.id], "ATTACHED")).toBe(1);
    expect(await repo.findAttached({ userId: uploader.id }, "USER_AVATAR")).toEqual([]);
  });

  it("finds stale PENDING and DELETED rows, oldest first, and deletes rows idempotently", async () => {
    const repo = createAttachmentRepository(prisma);
    const uploader = await createUser();
    const hourAgo = new Date(Date.now() - 60 * 60_000);
    const oldPending = await pending(uploader.id);
    await prisma.attachment.update({ where: { id: oldPending.id }, data: { createdAt: hourAgo } });
    const freshPending = await pending(uploader.id);
    const oldDeleted = await pending(uploader.id);
    await repo.markDeleted([oldDeleted.id], "PENDING");
    await prisma.attachment.update({ where: { id: oldDeleted.id }, data: { deletedAt: hourAgo } });
    const freshDeleted = await pending(uploader.id);
    await repo.markDeleted([freshDeleted.id], "PENDING");

    const cutoff = new Date(Date.now() - 60_000);
    const stalePending = (await repo.findPendingBefore(cutoff, 500)).map((row) => row.id);
    const staleDeleted = (await repo.findDeletedBefore(cutoff, 500)).map((row) => row.id);

    expect(stalePending).toContain(oldPending.id);
    expect(stalePending).not.toContain(freshPending.id);
    expect(staleDeleted).toContain(oldDeleted.id);
    expect(staleDeleted).not.toContain(freshDeleted.id);
    expect(staleDeleted).not.toContain(oldPending.id);

    expect(await repo.deleteById(oldDeleted.id)).toBe(1);
    expect(await repo.deleteById(oldDeleted.id)).toBe(0);
    expect(await repo.findById(oldDeleted.id)).toBeNull();
    expect(
      (await repo.findManyByIds([oldPending.id, freshPending.id])).map((row) => row.id).sort(),
    ).toEqual([oldPending.id, freshPending.id].sort());
  });
});

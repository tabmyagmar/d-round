import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createAttachmentRepository } from "../../src/repositories/attachment.repository";
import { createCsvExportRepository } from "../../src/repositories/csv-export.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createUser = () =>
  prisma.user.create({ data: { name: "出力 花子", email: `${crypto.randomUUID()}@example.com` } });

describe("csv export repository", () => {
  it("records downloads and pages one user's of one type, newest first, with the user", async () => {
    const repo = createCsvExportRepository(prisma);
    const user = await createUser();
    const older = await repo.create({
      type: "USER",
      fileName: "UserData_20261012.xlsx",
      rowCount: 3,
      createdById: user.id,
    });
    const newer = await repo.create({
      type: "USER",
      fileName: "UserData_20261013.xlsx",
      rowCount: 1,
      createdById: user.id,
    });
    await repo.create({
      type: "STAFF",
      fileName: "StaffData.xlsx",
      rowCount: 1,
      createdById: user.id,
    });

    expect(await repo.findById(older.id)).toMatchObject({ rowCount: 3, type: "USER" });
    const page = await repo.findPage(
      { page: 1, perPage: 10 },
      { createdById: user.id, type: "USER" },
    );
    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.items[0]?.createdBy).toEqual({ name: "出力 花子", email: user.email });
  });

  it("owns the file it wrote as a CSV_EXPORT attachment", async () => {
    const user = await createUser();
    const csvExport = await createCsvExportRepository(prisma).create({
      type: "CLIENT",
      fileName: "ClientData.xlsx",
      rowCount: 1,
      createdById: user.id,
    });
    const attachments = createAttachmentRepository(prisma);
    const file = await attachments.create({
      kind: "CSV_EXPORT",
      objectKey: `csv-exports/${crypto.randomUUID()}.xlsx`,
      fileName: "ClientData.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 2048,
      uploadedById: user.id,
    });

    await prisma.$transaction(async (tx) => {
      const locked = createAttachmentRepository(tx);
      await locked.lockOwner({ csvExportId: csvExport.id });
      await locked.attach([file.id], {
        uploadedById: user.id,
        kind: "CSV_EXPORT",
        owner: { csvExportId: csvExport.id },
      });
    });
    expect(await attachments.findAttached({ csvExportId: csvExport.id }, "CSV_EXPORT")).toEqual([
      expect.objectContaining({ id: file.id, status: "ATTACHED" }),
    ]);
  });
});

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import type { CsvImportType } from "../../src/generated/prisma/client";
import { createCsvImportRepository } from "../../src/repositories/csv-import.repository";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createUser = () =>
  prisma.user.create({ data: { name: "取込 太郎", email: `${crypto.randomUUID()}@example.com` } });

const createImport = async (createdById: string, type: CsvImportType = "USER_CREATE") =>
  createCsvImportRepository(prisma).create({ type, fileName: "担当者.csv", createdById });

const row = (lineNumber: number, errors: string[] = []) => ({
  lineNumber,
  data: { lastName: `姓${String(lineNumber)}` },
  errors,
});

/** Walks an import through the check to CHECKED with lines 2 and 3 valid and line 4 in error. */
const checkedImport = async (createdById: string) => {
  const repo = createCsvImportRepository(prisma);
  const csvImport = await createImport(createdById);
  await repo.claimCheck(csvImport.id);
  await repo.replaceRows(csvImport.id, [row(2), row(3), row(4, ["姓: 必須"])]);
  await repo.markChecked(csvImport.id, { totalCount: 3, validCount: 2, fileError: null });
  return csvImport;
};

const backdate = (id: string, minutes: number) =>
  prisma.$executeRaw`UPDATE csv_imports SET updated_at = now() - make_interval(mins => ${minutes}) WHERE id = ${id}::uuid`;

describe("csv import repository", () => {
  it("claims the check from UPLOADED, again for a retry, and not once checked", async () => {
    const repo = createCsvImportRepository(prisma);
    const user = await createUser();
    const csvImport = await createImport(user.id);
    expect(csvImport).toMatchObject({ status: "UPLOADED", totalCount: 0, fileError: null });

    expect(await repo.claimCheck(csvImport.id)).toBe(true);
    expect(await repo.claimCheck(csvImport.id)).toBe(true);
    expect(
      await repo.markChecked(csvImport.id, { totalCount: 0, validCount: 0, fileError: "x" }),
    ).toBe(true);

    expect(await repo.claimCheck(csvImport.id)).toBe(false);
    expect(
      await repo.markChecked(csvImport.id, { totalCount: 0, validCount: 0, fileError: null }),
    ).toBe(false);
    expect(await repo.findById(csvImport.id)).toMatchObject({ status: "CHECKED", fileError: "x" });
  });

  it("replaces the rows of an earlier check attempt and lists them in line order", async () => {
    const repo = createCsvImportRepository(prisma);
    const csvImport = await createImport((await createUser()).id);
    await repo.replaceRows(csvImport.id, [row(3), row(2)]);
    await repo.replaceRows(csvImport.id, [row(4, ["姓: 必須"]), row(2)]);

    const rows = await repo.findRows(csvImport.id);
    expect(rows.map((stored) => [stored.lineNumber, stored.errors])).toEqual([
      [2, []],
      [4, ["姓: 必須"]],
    ]);
  });

  it("confirms only the uploader's checked import and selects only rows without errors", async () => {
    const repo = createCsvImportRepository(prisma);
    const uploader = await createUser();
    const other = await createUser();
    const csvImport = await checkedImport(uploader.id);

    expect(await repo.selectRows(csvImport.id, [2, 4])).toBe(1);
    expect(await repo.markConfirmed(csvImport.id, other.id, 1)).toBe(false);
    expect(await repo.markConfirmed(csvImport.id, uploader.id, 1)).toBe(true);
    expect(await repo.markConfirmed(csvImport.id, uploader.id, 1)).toBe(false);

    expect(await repo.findById(csvImport.id)).toMatchObject({
      status: "CONFIRMED",
      selectedCount: 1,
    });
    const selected = (await repo.findRows(csvImport.id)).filter((stored) => stored.selected);
    expect(selected.map((stored) => stored.lineNumber)).toEqual([2]);
  });

  it("imports once: the claim, the rows left, their results and the final counts", async () => {
    const repo = createCsvImportRepository(prisma);
    const uploader = await createUser();
    const csvImport = await checkedImport(uploader.id);
    await repo.selectRows(csvImport.id, [2, 3]);
    await repo.markConfirmed(csvImport.id, uploader.id, 2);

    expect(await repo.claimImport(csvImport.id)).toBe(true);
    expect(await repo.claimImport(csvImport.id)).toBe(false);

    const [first, second] = await repo.findRowsToImport(csvImport.id);
    if (!first || !second) {
      throw new Error("two rows to import expected");
    }
    await repo.recordRowResult(first.id, { result: "IMPORTED", entityId: uploader.id });
    await repo.incrementProcessed(csvImport.id);
    expect((await repo.findRowsToImport(csvImport.id)).map((left) => left.lineNumber)).toEqual([3]);
    await repo.recordRowResult(second.id, {
      result: "FAILED",
      resultError: "既に登録されています",
    });
    await repo.incrementProcessed(csvImport.id);

    const counts = await repo.countResults(csvImport.id);
    expect(counts).toEqual({ imported: 1, failed: 1 });
    expect(
      await repo.markImported(csvImport.id, {
        importedCount: counts.imported,
        failedCount: counts.failed,
      }),
    ).toBe(true);
    expect(await repo.findById(csvImport.id)).toMatchObject({
      status: "IMPORTED",
      processedCount: 2,
      importedCount: 1,
      failedCount: 1,
    });
    // The heartbeat counts only while importing: a finished or failed import stops the loop.
    expect(await repo.incrementProcessed(csvImport.id)).toBe(false);
  });

  it("lets a heartbeat newer than the sweeper's cut-off keep the import going", async () => {
    const repo = createCsvImportRepository(prisma);
    const csvImport = await createImport((await createUser()).id);
    await repo.claimCheck(csvImport.id);

    expect(
      await repo.markFailed(csvImport.id, "CHECKING", "中断", new Date(Date.now() - 60_000)),
    ).toBe(false);
    expect(
      await repo.markFailed(csvImport.id, "CHECKING", "中断", new Date(Date.now() + 60_000)),
    ).toBe(true);
  });

  it("fails an import only from the status it names", async () => {
    const repo = createCsvImportRepository(prisma);
    const csvImport = await createImport((await createUser()).id);
    await repo.claimCheck(csvImport.id);

    expect(await repo.markFailed(csvImport.id, "IMPORTING", "中断")).toBe(false);
    expect(await repo.markFailed(csvImport.id, "CHECKING", "中断")).toBe(true);
    expect(await repo.findById(csvImport.id)).toMatchObject({
      status: "FAILED",
      lastError: "中断",
    });
  });

  it("finds imports whose last change is older than the cut-off", async () => {
    const repo = createCsvImportRepository(prisma);
    const user = await createUser();
    const stale = await createImport(user.id);
    const fresh = await createImport(user.id);
    await backdate(stale.id, 11);

    const found = await repo.findStale("UPLOADED", new Date(Date.now() - 10 * 60_000), 500);
    const ids = found.map((candidate) => candidate.id);
    expect(ids).toContain(stale.id);
    expect(ids).not.toContain(fresh.id);
  });

  it("pages one uploader's imports of one type, newest first, with the uploader", async () => {
    const repo = createCsvImportRepository(prisma);
    const user = await createUser();
    const older = await createImport(user.id);
    const newer = await createImport(user.id);
    await createImport(user.id, "STAFF_CREATE");
    await createImport((await createUser()).id);

    const page = await repo.findPage(
      { page: 1, perPage: 10 },
      { createdById: user.id, type: "USER_CREATE" },
    );
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.items[0]?.createdBy).toEqual({ name: "取込 太郎", email: user.email });
  });
});

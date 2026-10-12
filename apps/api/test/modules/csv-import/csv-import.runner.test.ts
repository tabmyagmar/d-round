import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCsvImportRepository, createUserRepository } from "@repo/database";
import type { CsvImportType } from "@repo/database";
import { createMemoryStorage } from "@repo/storage";

import {
  CSV_CHECK_FAILED,
  CSV_FILE_MISSING,
  CSV_TYPE_UNSUPPORTED,
  CSV_UPLOADER_INACTIVE,
  runCsvCheck,
  runCsvImport,
} from "../../../src/modules/csv-import/csv-import.runner";
import { contextDeps, createHarness, signedInUser, uniqueEmployeeNumber } from "../../support";
import type { SignedInUser, TestHarness } from "../../support";

import { userCsv, userLine } from "./user-csv";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

/** An import as `csvImport.create` leaves it: UPLOADED, its file attached and in the bucket. */
const uploaded = async (
  uploader: SignedInUser,
  text: string,
  type: CsvImportType = "USER_CREATE",
  { inBucket = true } = {},
) => {
  const csvImport = await h.db.csvImport.create({
    data: { type, fileName: "担当者.csv", createdById: uploader.user.id },
  });
  const body = new TextEncoder().encode(text);
  const objectKey = `csv-imports/${crypto.randomUUID()}.csv`;
  await h.db.attachment.create({
    data: {
      kind: "CSV_IMPORT",
      status: "ATTACHED",
      objectKey,
      fileName: "担当者.csv",
      contentType: "text/csv",
      size: body.length,
      uploadedById: uploader.user.id,
      csvImportId: csvImport.id,
      attachedAt: new Date(),
    },
  });
  if (inBucket) {
    h.storage.put(objectKey, { size: body.length, contentType: "text/csv", body });
  }
  return csvImport;
};

const job = (csvImportId: string, lastAttempt = true) => ({
  csvImportId,
  traceId: "test",
  lastAttempt,
});

const stored = (id: string) => h.db.csvImport.findUniqueOrThrow({ where: { id } });
const rowsOf = async (id: string) => createCsvImportRepository(h.db).findRows(id);

/** Confirms every valid row, as `csvImport.confirm` will. */
const confirmAll = async (uploader: SignedInUser, csvImportId: string) => {
  const repo = createCsvImportRepository(h.db);
  const lines = (await repo.findRows(csvImportId))
    .filter((row) => row.errors.length === 0)
    .map((row) => row.lineNumber);
  await repo.selectRows(csvImportId, lines);
  await repo.markConfirmed(csvImportId, uploader.user.id, lines.length);
};

describe("runCsvCheck", () => {
  it("checks every row: the format, repeats within the file and the database", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const existing = await signedInUser(h);
    const valid = userLine();
    const csvImport = await uploaded(
      admin,
      userCsv(
        valid.text,
        userLine({ lastNameKana: "やまだ" }).text,
        userLine({ email: existing.email }).text,
        userLine({ email: valid.email }).text,
        userLine({ regions: "南関東,月" }).text,
      ),
    );

    expect(await runCsvCheck(contextDeps(h), job(csvImport.id))).toBe("checked");

    expect(await stored(csvImport.id)).toMatchObject({
      status: "CHECKED",
      totalCount: 5,
      validCount: 1,
      fileError: null,
    });
    const rows = await rowsOf(csvImport.id);
    expect(rows.map((row) => row.lineNumber)).toEqual([2, 3, 4, 5, 6]);
    expect(rows[0]?.data).toMatchObject({ email: valid.email, regionCodes: "南関東" });
    expect(rows.slice(0, 4).map((row) => row.errors)).toEqual([
      [],
      ["セイ: 全角カタカナで入力してください"],
      [`メールアドレス: ${existing.email} 既に登録されています`],
      [`メールアドレス: ${valid.email} CSV内で重複しています`],
    ]);
    expect(rows[4]?.errors).toEqual([expect.stringMatching(/^地区: 「月」は使えません（北海道、/)]);
  });

  it("refuses a role the uploader may not give, as the form would not offer it", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    const csvImport = await uploaded(manager, userCsv(userLine({ role: "アドミン" }).text));

    await runCsvCheck(contextDeps(h), job(csvImport.id));

    expect((await rowsOf(csvImport.id))[0]?.errors).toEqual([
      "アカウントタイプ: 「アドミン」は登録できません",
    ]);
  });

  it("stores a finding about the whole file and no rows", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const csvImport = await uploaded(admin, "社員番号,姓\r\n1,山田\r\n");

    await runCsvCheck(contextDeps(h), job(csvImport.id));

    expect(await stored(csvImport.id)).toMatchObject({
      status: "CHECKED",
      totalCount: 0,
      fileError: expect.stringMatching(/^必要な列がありません: 名（必須）/) as unknown,
    });
    expect(await rowsOf(csvImport.id)).toEqual([]);
  });

  it("fails an import whose file is gone, whose uploader left or whose type is not ported yet", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const leaving = await signedInUser(h, { role: "admin" });
    const noFile = await uploaded(admin, userCsv(userLine().text), "USER_CREATE", {
      inBucket: false,
    });
    const leftBehind = await uploaded(leaving, userCsv(userLine().text));
    await createUserRepository(h.db).softDelete(leaving.user.id);
    const notPorted = await uploaded(admin, userCsv(userLine().text), "CLIENT_CREATE");

    for (const csvImport of [noFile, leftBehind, notPorted]) {
      expect(await runCsvCheck(contextDeps(h), job(csvImport.id))).toBe("failed");
    }
    expect((await stored(noFile.id)).lastError).toBe(CSV_FILE_MISSING);
    expect((await stored(leftBehind.id)).lastError).toBe(CSV_UPLOADER_INACTIVE);
    expect((await stored(notPorted.id)).lastError).toBe(CSV_TYPE_UNSUPPORTED);
  });

  it("is tried again after a failure and fails the import on the last attempt", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const csvImport = await uploaded(admin, userCsv(userLine().text));
    const storage = createMemoryStorage();
    const broken = {
      ...contextDeps(h),
      storage: { ...storage, download: () => Promise.reject(new Error("storage unavailable")) },
    };

    await expect(runCsvCheck(broken, job(csvImport.id, false))).rejects.toThrow(
      "storage unavailable",
    );
    expect((await stored(csvImport.id)).status).toBe("CHECKING");

    expect(await runCsvCheck(broken, job(csvImport.id, true))).toBe("failed");
    expect(await stored(csvImport.id)).toMatchObject({
      status: "FAILED",
      lastError: CSV_CHECK_FAILED,
    });
  });

  it("does nothing the second time, or for an import that does not exist", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const csvImport = await uploaded(admin, userCsv(userLine().text));

    expect(await runCsvCheck(contextDeps(h), job(csvImport.id))).toBe("checked");
    expect(await runCsvCheck(contextDeps(h), job(csvImport.id))).toBe("skipped");
    expect(await runCsvCheck(contextDeps(h), job(crypto.randomUUID()))).toBe("missing");
  });
});

describe("runCsvImport", () => {
  it("invites each confirmed row through the user service, a refused row not stopping the rest", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const first = userLine({ position: "AM" });
    const second = userLine();
    const csvImport = await uploaded(admin, userCsv(first.text, second.text));
    await runCsvCheck(contextDeps(h), job(csvImport.id));
    await confirmAll(admin, csvImport.id);
    // Someone takes the second address between the check and the import.
    await h.auth.api.createUser({ body: { email: second.email, name: "先客", role: "am" } });

    expect(await runCsvImport(contextDeps(h), job(csvImport.id))).toBe("imported");

    expect(await stored(csvImport.id)).toMatchObject({
      status: "IMPORTED",
      processedCount: 2,
      importedCount: 1,
      failedCount: 1,
    });
    const [imported, refused] = await rowsOf(csvImport.id);
    expect(refused).toMatchObject({
      result: "FAILED",
      resultError: "既に登録されているため、登録できませんでした",
      entityId: null,
    });
    const user = await createUserRepository(h.db).findByEmail(first.email);
    expect(imported).toMatchObject({ result: "IMPORTED", entityId: user?.id });
    expect(user).toMatchObject({
      name: "山田 太郎",
      lastNameKana: "ヤマダ",
      role: "am",
      profile: {
        employeeNumber: Number(first.employeeNumber),
        departmentName: "人事部",
        position: "SV",
        areas: ["EAST"],
      },
    });
    expect(
      await h.db.outboxEmail.findFirst({
        where: { to: first.email, template: "account-invitation" },
      }),
    ).not.toBeNull();

    expect(await runCsvImport(contextDeps(h), job(csvImport.id))).toBe("skipped");
  });

  it("acts with the uploader's current grants: a permission revoked since the check fails the rows", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const csvImport = await uploaded(admin, userCsv(userLine().text));
    await runCsvCheck(contextDeps(h), job(csvImport.id));
    await confirmAll(admin, csvImport.id);
    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1101", effect: "DENY" },
    });

    await runCsvImport(contextDeps(h), job(csvImport.id));

    expect(await stored(csvImport.id)).toMatchObject({ importedCount: 0, failedCount: 1 });
    expect((await rowsOf(csvImport.id))[0]?.resultError).toBe(
      "権限がないため、登録できませんでした",
    );
  });

  it("updates a 担当者 found by 社員番号, refusing an unknown number and a new address", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const target = await signedInUser(h, { profile: {} });
    const other = await signedInUser(h, { profile: {} });
    const targetNumber = (await createUserRepository(h.db).findById(target.user.id))?.profile
      ?.employeeNumber;
    const otherNumber = (await createUserRepository(h.db).findById(other.user.id))?.profile
      ?.employeeNumber;
    const unknown = uniqueEmployeeNumber();
    const csvImport = await uploaded(
      admin,
      userCsv(
        userLine({ employeeNumber: String(targetNumber), lastName: "改名", email: "" }).text,
        userLine({ employeeNumber: String(unknown) }).text,
        userLine({ employeeNumber: String(otherNumber), email: "new@example.com" }).text,
      ),
      "USER_UPDATE",
    );

    await runCsvCheck(contextDeps(h), job(csvImport.id));
    expect((await rowsOf(csvImport.id)).map((row) => row.errors)).toEqual([
      [],
      [`社員番号: ${String(unknown)} の担当者が見つかりません`],
      [`メールアドレス: 変更できません（登録済み: ${other.email}）`],
    ]);

    await confirmAll(admin, csvImport.id);
    await runCsvImport(contextDeps(h), job(csvImport.id));

    expect(await stored(csvImport.id)).toMatchObject({ importedCount: 1, failedCount: 0 });
    expect(await createUserRepository(h.db).findById(target.user.id)).toMatchObject({
      name: "改名 太郎",
      email: target.email,
      profile: { departmentName: "人事部", position: "FULL_TIME_EMPLOYEE" },
    });
  });
});

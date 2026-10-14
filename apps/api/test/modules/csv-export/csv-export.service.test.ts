import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { read, utils } from "xlsx";

import { createUserRepository } from "@repo/database";
import {
  BRANCH_EXPORT_FIELDS,
  STAFF_EXPORT_FIELDS,
  USER_EXPORT_FIELDS,
  createCsvExportSchema,
} from "@repo/validation";
import type { z } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { ForbiddenError, NotFoundError } from "../../../src/core/errors";
import * as branchService from "../../../src/modules/branch/branch.service";
import * as clientService from "../../../src/modules/client/client.service";
import * as csvExportService from "../../../src/modules/csv-export/csv-export.service";
import * as staffService from "../../../src/modules/staff/staff.service";
import * as userService from "../../../src/modules/user/user.service";
import {
  branchInput,
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
} from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

/** An admin's context (every catalog grant a download needs) and a 担当者 to assign. */
const adminWithCharger = async () => {
  const admin = await signedInUser(h, { role: "admin" });
  const charger = await signedInUser(h, { name: "担当 一郎", profile: {} });
  return { admin, ctx: await contextFor(h, admin.headers), chargerId: charger.user.id };
};

/** A download of the input exactly as the router hands it to the service. */
const exportOf = (ctx: RequestContext, input: z.input<typeof createCsvExportSchema>) =>
  csvExportService.create(ctx, createCsvExportSchema.parse(input));

const keysOf = <K extends string>(fields: readonly { key: K }[]): K[] =>
  fields.map((field) => field.key);

const headersOf = (fields: readonly { header: string }[]): string[] =>
  fields.map((field) => field.header);

/** The stored workbook of a download, each sheet's rows as text, in tab order. */
const workbookOf = async (csvExportId: string): Promise<Record<string, string[][]>> => {
  const file = await h.db.attachment.findFirstOrThrow({
    where: { csvExportId, status: "ATTACHED" },
  });
  const bytes = await h.storage.download(file.objectKey);
  if (!bytes) {
    throw new Error("the workbook is not in the bucket");
  }
  const workbook = read(bytes);
  const sheets: Record<string, string[][]> = {};
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet) {
      sheets[name] = utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    }
  }
  return sheets;
};

describe("csvExport.create", () => {
  it("writes the ticked スタッフ with the picked columns and the 家族情報 of the 続柄 picked", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const staff = await staffService.create(
      ctx,
      staffInput([chargerId], {
        emergencyPhoneNumber: "03-1111-2222",
        jobHistories: [
          { hireDate: "2018-04-01", resignationDate: "2019-03-31", resignationReason: "転居" },
          { hireDate: "2020-04-01", resignationDate: null, resignationReason: null },
        ],
        familyMembers: [
          {
            lastName: "山田",
            firstName: "太郎",
            lastNameKana: null,
            firstNameKana: null,
            relation: "HUSBAND",
            birthday: null,
          },
          {
            lastName: "山田",
            firstName: "一郎",
            lastNameKana: "ヤマダ",
            firstNameKana: "イチロウ",
            relation: "ELDEST_SON",
            birthday: "2015-05-05",
          },
        ],
      }),
    );
    const gone = await staffService.create(ctx, staffInput([chargerId]));
    await staffService.changeStatus(ctx, { staffId: gone.id, status: "SUSPENDED" });
    await staffService.removeMany(ctx, { staffIds: [gone.id] });

    const csvExport = await exportOf(ctx, {
      type: "STAFF",
      ids: [staff.id, gone.id, crypto.randomUUID()],
      fields: keysOf(STAFF_EXPORT_FIELDS),
      familyRelations: ["ELDEST_SON"],
    });

    expect(csvExport).toMatchObject({
      type: "STAFF",
      rowCount: 1,
      fileName: expect.stringMatching(/^StaffData_\d{8}\.xlsx$/u) as unknown,
      url: expect.stringMatching(/^memory:\/\/read\/csv-exports\/.+\.xlsx\?filename=StaffData_/u),
    });
    expect(await workbookOf(csvExport.id)).toEqual({
      スタッフ情報: [
        headersOf(STAFF_EXPORT_FIELDS),
        [
          "正社員",
          String(staff.employeeNumber),
          "山田",
          "花子",
          "ヤマダ",
          "ハナコ",
          "東日本",
          "南関東",
          "東京都",
          "担当 一郎",
          "新宿支店",
          "スタッフ",
          "1990/04/01",
          "女性",
          "1600022",
          "東京都新宿区新宿",
          "1-2-3",
          "090-1234-5678",
          "03-1111-2222",
          "",
          "2020/04/01",
          "",
          "",
          "利用中",
        ],
      ],
      家族情報: [
        ["スタッフ番号", "姓", "名", "セイ", "メイ", "続柄", "生年月日"],
        [String(staff.employeeNumber), "山田", "一郎", "ヤマダ", "イチロウ", "長男", "2015/05/05"],
      ],
    });
  });

  it("writes the ticked 担当者 by label, a 停止 one included, as the list shows them", async () => {
    const { ctx } = await adminWithCharger();
    const active = await signedInUser(h, {
      profile: { departmentName: "人事部", retirementDate: new Date("2027-03-31") },
    });
    const stopped = await signedInUser(h, { profile: {} });
    await h.db.user.update({
      where: { id: active.user.id },
      data: {
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
      },
    });
    await userService.deactivate(ctx, stopped.user.id);
    const profile = (await createUserRepository(h.db).findById(active.user.id))?.profile;

    const csvExport = await exportOf(ctx, {
      type: "USER",
      ids: [stopped.user.id, active.user.id],
      fields: keysOf(USER_EXPORT_FIELDS),
    });

    expect(csvExport.rowCount).toBe(2);
    const [header, ...rows] = (await workbookOf(csvExport.id))["担当者情報"] ?? [];
    expect(header).toEqual(headersOf(USER_EXPORT_FIELDS));
    expect(rows).toContainEqual([
      String(profile?.employeeNumber),
      "山田",
      "太郎",
      "ヤマダ",
      "タロウ",
      "東日本",
      "南関東",
      "人事部",
      "AM",
      active.email,
      "2027/03/31",
      "利用中",
    ]);
    expect(rows.find((row) => row.includes(stopped.email))?.at(-1)).toBe("停止");
  });

  it("adds the 就業先部署情報 of the クライアント's branches, each after its client", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const client = await clientService.create(ctx, clientInput([chargerId]));
    await branchService.create(
      ctx,
      branchInput(client.id, [chargerId], { number: 2, name: "渋谷店" }),
    );
    await branchService.create(ctx, branchInput(client.id, [chargerId]));

    const csvExport = await exportOf(ctx, {
      type: "CLIENT",
      ids: [client.id],
      fields: ["orderTypes", "number", "name"],
      branchFields: ["contactPosition", "number", "name", "prefCity", "address1"],
    });

    const clientCells = [String(client.number), "株式会社テスト"];
    expect(await workbookOf(csvExport.id)).toEqual({
      クライアント情報: [
        ["クライアント番号", "クライアント名", "受注区分"],
        [...clientCells, "派遣"],
      ],
      就業先部署情報: [
        [
          "クライアント番号",
          "クライアント名",
          "就業先番号",
          "就業先名",
          "住所",
          "詳細住所",
          "役職",
        ],
        [...clientCells, "1", "新宿店", "東京都新宿区新宿", "1-2-3", "リーダー"],
        [...clientCells, "2", "渋谷店", "東京都新宿区新宿", "1-2-3", "リーダー"],
      ],
    });
  });

  it("writes the ticked 就業先部署 after their client's number and name", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const client = await clientService.create(ctx, clientInput([chargerId]));
    const branch = await branchService.create(ctx, branchInput(client.id, [chargerId]));

    const csvExport = await exportOf(ctx, {
      type: "BRANCH",
      ids: [branch.id],
      fields: keysOf(BRANCH_EXPORT_FIELDS),
    });

    expect(csvExport.fileName).toMatch(/^BranchData_\d{8}\.xlsx$/u);
    expect((await workbookOf(csvExport.id))["就業先部署情報"]).toEqual([
      ["クライアント番号", "クライアント名", ...headersOf(BRANCH_EXPORT_FIELDS)],
      [
        String(client.number),
        "株式会社テスト",
        "1",
        "新宿店",
        "シンジュクテン",
        "10",
        "営業部",
        "エイギョウブ",
        "東日本",
        "南関東",
        "担当 一郎",
        "",
        "1600022",
        "東京都新宿区新宿",
        "1-2-3",
        "利用中",
        "山田",
        "太郎",
        "ヤマダ",
        "タロウ",
        "リーダー",
        "yamada@example.com",
      ],
    ]);
  });

  it("needs the grant to read every row of the entity, for the branch sheet as well", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    const managerCtx = await contextFor(h, manager.headers);
    await expect(
      exportOf(managerCtx, { type: "USER", ids: [manager.user.id], fields: ["email"] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await h.db.csvExport.count({ where: { createdById: manager.user.id } })).toBe(0);

    const { admin, chargerId } = await adminWithCharger();
    // Grants are read at session lookup, so the DENY row goes in before the context is built.
    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1802", effect: "DENY" },
    });
    const ctx = await contextFor(h, admin.headers);
    const client = await clientService.create(ctx, clientInput([chargerId]));

    await expect(
      exportOf(ctx, { type: "CLIENT", ids: [client.id], fields: ["name"], branchFields: ["name"] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      exportOf(ctx, { type: "CLIENT", ids: [client.id], fields: ["name"] }),
    ).resolves.toMatchObject({ rowCount: 1 });
  });
});

describe("csvExport history", () => {
  it("keeps every download its maker's: 履歴 newest first, a new URL for one's own only", async () => {
    const { admin, ctx, chargerId } = await adminWithCharger();
    const other = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
    const client = await clientService.create(ctx, clientInput([chargerId]));
    const older = await exportOf(ctx, { type: "CLIENT", ids: [client.id], fields: ["name"] });
    const newer = await exportOf(ctx, { type: "CLIENT", ids: [client.id], fields: ["number"] });
    await exportOf(other, { type: "CLIENT", ids: [client.id], fields: ["name"] });

    const page = await csvExportService.list(ctx, { type: "CLIENT", page: 1, perPage: 20 });
    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.items[0]?.createdBy.email).toBe(admin.email);
    expect(
      (await csvExportService.list(ctx, { type: "STAFF", page: 1, perPage: 20 })).items,
    ).toEqual([]);

    expect(await csvExportService.downloadUrl(ctx, older.id)).toMatchObject({
      id: older.id,
      rowCount: 1,
      url: expect.stringMatching(/^memory:\/\/read\/csv-exports\//u) as unknown,
    });
    await expect(csvExportService.downloadUrl(other, older.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("hands a file out again only with the grants it takes to make it now", async () => {
    const { admin, ctx, chargerId } = await adminWithCharger();
    const client = await clientService.create(ctx, clientInput([chargerId]));
    const csvExport = await exportOf(ctx, { type: "CLIENT", ids: [client.id], fields: ["name"] });
    // Grants are read at session lookup, so the DENY rows go in before each context is built.
    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1802", effect: "DENY" },
    });
    const noBranches = await contextFor(h, admin.headers);

    // A client's file may hold its branches' sheet: without the branch grant, not again.
    await expect(csvExportService.downloadUrl(noBranches, csvExport.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(
      (await csvExportService.list(noBranches, { type: "CLIENT", page: 1, perPage: 20 })).items,
    ).toHaveLength(1);

    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1202", effect: "DENY" },
    });
    const noClients = await contextFor(h, admin.headers);
    await expect(
      csvExportService.list(noClients, { type: "CLIENT", page: 1, perPage: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
